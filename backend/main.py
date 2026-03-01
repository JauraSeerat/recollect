"""
Notes App - Main API Server
FastAPI backend with PostgreSQL and Cloud Storage
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import database as db
import storage
import os
import uuid
import auth
import re
import httpx

OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "").rstrip("/")
OCR_TIMEOUT_SECONDS = float(os.getenv("OCR_TIMEOUT_SECONDS", "120"))

# Initialize FastAPI
app = FastAPI(title="Notes App API")

# CORS Configuration
RAW_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://pacific-quietude-production-ddaf.up.railway.app",
    ).split(",")
    if origin.strip()
]

ALLOW_ALL_ORIGINS = "*" in RAW_ALLOWED_ORIGINS
ALLOWED_ORIGINS = [origin for origin in RAW_ALLOWED_ORIGINS if "*" not in origin and origin != "*"]

# Always support localhost/127.0.0.1 on any port for local development.
origin_regex_parts = [r"https?://(localhost|127\.0\.0\.1)(:\d+)?"]

# Support wildcard origins from env (example: https://*.railway.app).
for origin in RAW_ALLOWED_ORIGINS:
    if "*" in origin and origin != "*":
        escaped = origin.replace(".", r"\.").replace("*", ".*")
        origin_regex_parts.append(escaped)

ALLOW_ORIGIN_REGEX = "|".join(origin_regex_parts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ALLOW_ALL_ORIGINS else ALLOWED_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STARTUP/SHUTDOWN ====================

# @app.on_event("startup")
# async def startup():
#     """Initialize database on startup"""
#     await db.connect_db()
#     await db.create_tables()
#     print("🚀 Server started successfully")

@app.on_event("startup")
async def startup():
    """Initialize database on startup"""
    await db.connect_db()
    await db.create_tables()
    print("🚀 Server started successfully")

@app.on_event("shutdown")
async def shutdown():
    """Close database on shutdown"""
    await db.disconnect_db()
    print("👋 Server stopped")


# ==================== PYDANTIC MODELS ====================

class UserLogin(BaseModel):
    email: str

class EntryCreate(BaseModel):
    user_id: Optional[str] = None
    content: str
    title: Optional[str] = None
    subject: Optional[str] = "General"
    entry_date: Optional[str] = None
    image_paths: Optional[List[str]] = None

class EntryUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None

class UserSignup(BaseModel):
    email: str
    password: str

class UserLoginWithPassword(BaseModel):
    email: str
    password: str

class PasswordResetRequest(BaseModel):
    email: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_email(value: str) -> str:
    normalized = _normalize_email(value)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    return normalized


def _ensure_user_access(path_user_id: str, current_user: dict):
    if path_user_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden"
        )

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected",
        "ocr_service_configured": bool(OCR_SERVICE_URL),
        "ocr_service_url": OCR_SERVICE_URL or None,
        "cloud_storage": storage.is_cloud_storage_enabled()
    }


# ==================== USER ROUTES ====================
@app.post("/api/admin/migrate")
async def migrate_database(current_user: dict = Depends(auth.get_current_user)):
    """Add password_hash column to users table"""
    allowed_admins = {
        _normalize_email(email)
        for email in os.getenv("ADMIN_EMAILS", os.getenv("ADMIN_USERNAMES", "")).split(",")
        if email.strip()
    }
    if not allowed_admins or _normalize_email(current_user.get("email", "")) not in allowed_admins:
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        await db.database.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash TEXT
        """)
        return {"status": "success", "message": "Migration complete - password_hash column added"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
        
@app.post("/api/auth/signup", response_model=Token)
async def signup(user_data: UserSignup):
    """Register a new user"""
    email = _validate_email(user_data.email)

    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    try:
        # Hash password
        password_hash = auth.hash_password(user_data.password)

        # Create user
        user = await db.create_user(
            email=email,
            password_hash=password_hash
        )
    except Exception as exc:
        if db.is_unique_violation(exc):
            raise HTTPException(status_code=400, detail="Email already exists")
        raise

    if not user:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create access token
    access_token = auth.create_access_token(
        data={"user_id": user["user_id"], "email": user["email"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "email": user["email"]
    }


@app.post("/api/auth/login", response_model=Token)
async def login(credentials: UserLoginWithPassword):
    """Login with email and password"""
    email = _validate_email(credentials.email)

    # Get user with password
    user = await db.get_user_with_password(email)
    
    if not user or not user.get('password_hash'):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not auth.verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create access token
    access_token = auth.create_access_token(
        data={"user_id": user["user_id"], "email": user["email"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "email": user["email"]
    }


@app.post("/api/auth/reset-password")
async def reset_password(data: PasswordResetRequest):
    """Reset password by email."""
    email = _validate_email(data.email)

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing_user = await db.get_user_with_password(email)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found for this email")

    new_password_hash = auth.hash_password(data.new_password)
    updated = await db.update_user_password(email, new_password_hash)
    if not updated:
        raise HTTPException(status_code=500, detail="Unable to reset password")

    return {"status": "success", "message": "Password updated successfully"}


# Keep old endpoint for backward compatibility (optional)
@app.post("/api/users/login")
async def login_user_old(user: UserLogin):
    """Old login endpoint (no password) - for backward compatibility"""
    raise HTTPException(
        status_code=400, 
        detail="Please use /api/auth/login with email and password"
    )


@app.get("/api/users/{user_id}")
async def get_user(user_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get user by ID"""
    _ensure_user_access(user_id, current_user)

    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/api/users/{user_id}/stats")
async def get_user_stats(user_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get user statistics"""
    _ensure_user_access(user_id, current_user)
    return await db.get_user_statistics(user_id)


# ==================== ENTRY ROUTES ====================

@app.post("/api/entries")
async def create_entry(entry: EntryCreate, current_user: dict = Depends(auth.get_current_user)):
    """Create a new note entry"""
    # Create entry
    entry_id = await db.create_entry(
        user_id=current_user["user_id"],
        content=entry.content,
        title=entry.title,
        subject=entry.subject,
        entry_date=entry.entry_date
    )
    
    # Add media if provided
    if entry.image_paths:
        for path in entry.image_paths:
            await db.add_media(entry_id, "image", path)
    
    return {"id": entry_id, "status": "success"}


@app.get("/api/users/{user_id}/entries")
async def get_user_entries(user_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get all entries for a user"""
    _ensure_user_access(user_id, current_user)
    return await db.get_user_entries(user_id)


@app.get("/api/entries/{entry_id}")
async def get_entry(entry_id: int, current_user: dict = Depends(auth.get_current_user)):
    """Get a single entry"""
    entry = await db.get_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.put("/api/entries/{entry_id}")
async def update_entry(entry_id: int, entry: EntryUpdate, current_user: dict = Depends(auth.get_current_user)):
    """Update an entry"""
    entry_owner = await db.get_entry_owner(entry_id)
    if not entry_owner or entry_owner.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.update_entry(
        entry_id=entry_id,
        content=entry.content,
        title=entry.title,
        subject=entry.subject
    )
    return {"status": "success"}


@app.delete("/api/entries/{entry_id}")
async def delete_entry(entry_id: int, current_user: dict = Depends(auth.get_current_user)):
    """Delete an entry"""
    # Get entry to delete associated media
    entry = await db.get_entry(entry_id)
    if not entry or entry.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    if entry.get('media_paths'):
        for media_path in entry['media_paths']:
            # Delete from cloud storage if enabled
            if storage.is_cloud_storage_enabled():
                storage.delete_from_cloud(media_path)
            else:
                storage.delete_from_local(media_path)
    
    # Delete entry (cascade deletes media records)
    await db.delete_entry(entry_id)
    return {"status": "success"}


@app.get("/api/users/{user_id}/search")
async def search_entries(user_id: str, query: str, current_user: dict = Depends(auth.get_current_user)):
    """Search entries"""
    _ensure_user_access(user_id, current_user)
    return await db.search_entries(user_id, query)


@app.get("/api/users/{user_id}/subjects/{subject}/entries")
async def get_entries_by_subject(user_id: str, subject: str, current_user: dict = Depends(auth.get_current_user)):
    """Get entries by subject"""
    _ensure_user_access(user_id, current_user)
    return await db.get_entries_by_subject(user_id, subject)


@app.get("/api/users/{user_id}/subjects")
async def get_subjects(user_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get all unique subjects for a user"""
    _ensure_user_access(user_id, current_user)
    return await db.get_user_subjects(user_id)


# ==================== UPLOAD ROUTES ====================

@app.post("/api/upload/image")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = None,
    current_user: dict = Depends(auth.get_current_user),
):
    """Upload a file (image) to cloud storage or local disk"""
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Never trust client-provided user_id for storage paths.
    object_name = f"{current_user['user_id']}/{unique_filename}"
    
    # Read file bytes
    file_bytes = await file.read()
    
    # Upload to cloud or save locally
    if storage.is_cloud_storage_enabled():
        # Upload to Cloudflare R2
        file_url = storage.upload_to_cloud(
            file_bytes=file_bytes,
            object_name=object_name,
            content_type=file.content_type
        )
    else:
        # Save locally
        file_path = storage.save_to_local(file_bytes, object_name)
        file_url = f"/api/media/{object_name}"
    
    return {
        "file_path": file_url,
        "filename": unique_filename,
        "content_type": file.content_type
    }


@app.get("/api/media/{user_id}/{filename}")
async def get_media(
    user_id: str,
    filename: str,
    current_user: dict = Depends(auth.get_current_user),
):
    """Serve uploaded media files (for local storage only)"""
    _ensure_user_access(user_id, current_user)

    if storage.is_cloud_storage_enabled():
        raise HTTPException(
            status_code=404, 
            detail="Media served from cloud storage"
        )
    
    file_path = os.path.join(storage.LOCAL_UPLOAD_DIR, user_id, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)


# ==================== OCR ROUTES ====================

def _require_ocr_service_url():
    if not OCR_SERVICE_URL:
        raise HTTPException(
            status_code=503,
            detail="OCR service URL is not configured"
        )


async def _proxy_ocr_request(path: str, files_payload):
    _require_ocr_service_url()
    target_url = f"{OCR_SERVICE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=OCR_TIMEOUT_SECONDS) as client:
            response = await client.post(target_url, files=files_payload)
    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="OCR service is unavailable"
        )

    if response.status_code >= 400:
        error_detail = "OCR request failed"
        try:
            error_body = response.json()
            error_detail = error_body.get("detail") or error_body.get("message") or error_detail
        except Exception:
            pass
        raise HTTPException(status_code=response.status_code, detail=error_detail)

    return response.json()

@app.post("/api/ocr/extract")
async def extract_text_from_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """Proxy single-image OCR request to external OCR service"""
    _ = current_user
    file_bytes = await file.read()
    files_payload = [
        ("file", (file.filename or "upload.jpg", file_bytes, file.content_type or "application/octet-stream"))
    ]
    return await _proxy_ocr_request("/extract", files_payload)


@app.post("/api/ocr/extract-multiple")
async def extract_text_from_multiple(
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """Proxy multi-image OCR request to external OCR service"""
    _ = current_user
    files_payload = []
    for file in files:
        file_bytes = await file.read()
        files_payload.append(
            ("files", (file.filename or "upload.jpg", file_bytes, file.content_type or "application/octet-stream"))
        )
    return await _proxy_ocr_request("/extract-multiple", files_payload)


# ==================== ROOT ====================

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Notes App API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
