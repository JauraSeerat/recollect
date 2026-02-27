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
from datetime import datetime
import easyocr
import auth

# Global variables at the top
OCR_AVAILABLE = False
reader = None

# Import OCR if available
# try:
#     import easyocr
#     OCR_AVAILABLE = True
#     reader = easyocr.Reader(['en'])
# except:
#     OCR_AVAILABLE = False
#     print("⚠️  EasyOCR not available - OCR features disabled")

# Initialize FastAPI
app = FastAPI(title="Notes App API")

# CORS Configuration
# ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://pacific-quietude-production-ddaf.up.railway.app",
    # "http://localhost:5173",  # for local frontend development
    ],
    allow_credentials=True,
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
    """Initialize database and OCR on startup"""
    global OCR_AVAILABLE, reader
    
    await db.connect_db()
    await db.create_tables()
    print("🚀 Server started successfully")
    
    # Pre-load EasyOCR (downloads models once)
    try:
        print("🔄 Loading EasyOCR models (first time: 3-5 min)...")
        reader = easyocr.Reader(['en'], gpu=False)
        # reader  = None 
        OCR_AVAILABLE = True
        print("✅ EasyOCR loaded and ready!")
    except Exception as e:
        print(f"⚠️ EasyOCR failed to load: {e}")
        OCR_AVAILABLE = False

@app.on_event("shutdown")
async def shutdown():
    """Close database on shutdown"""
    await db.disconnect_db()
    print("👋 Server stopped")


# ==================== PYDANTIC MODELS ====================

class UserLogin(BaseModel):
    username: str

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
    username: str
    password: str

class UserLoginWithPassword(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str


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
        "ocr_available": OCR_AVAILABLE,
        "cloud_storage": storage.is_cloud_storage_enabled()
    }


# ==================== USER ROUTES ====================
@app.post("/api/admin/migrate")
async def migrate_database(current_user: dict = Depends(auth.get_current_user)):
    """Add password_hash column to users table"""
    allowed_admins = {
        username.strip()
        for username in os.getenv("ADMIN_USERNAMES", "").split(",")
        if username.strip()
    }
    if not allowed_admins or current_user.get("username") not in allowed_admins:
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
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    try:
        # Hash password
        password_hash = auth.hash_password(user_data.password)

        # Create user
        user = await db.create_user(
            username=user_data.username.strip(),
            password_hash=password_hash
        )
    except Exception as exc:
        if db.is_unique_violation(exc):
            raise HTTPException(status_code=400, detail="Username already exists")
        raise

    if not user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create access token
    access_token = auth.create_access_token(
        data={"user_id": user["user_id"], "username": user["username"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "username": user["username"]
    }


@app.post("/api/auth/login", response_model=Token)
async def login(credentials: UserLoginWithPassword):
    """Login with username and password"""
    # Get user with password
    user = await db.get_user_with_password(credentials.username.strip())
    
    if not user or not user.get('password_hash'):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    if not auth.verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    access_token = auth.create_access_token(
        data={"user_id": user["user_id"], "username": user["username"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "username": user["username"]
    }


# Keep old endpoint for backward compatibility (optional)
@app.post("/api/users/login")
async def login_user_old(user: UserLogin):
    """Old login endpoint (no password) - for backward compatibility"""
    raise HTTPException(
        status_code=400, 
        detail="Please use /api/auth/login with password"
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

# @app.post("/api/ocr/extract")
# async def extract_text_from_image(file: UploadFile = File(...)):
#     """Extract text from image using OCR"""
#     if not OCR_AVAILABLE:
#         raise HTTPException(
#             status_code=503, 
#             detail="OCR service not available"
#         )
    
#     try:
#         # Save temporarily
#         temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        
#         with open(temp_path, "wb") as f:
#             f.write(await file.read())
        
#         # Extract text
#         result = reader.readtext(temp_path)
#         extracted_text = ' '.join([detection[1] for detection in result])
        
#         # Clean up
#         os.remove(temp_path)
        
#         return {
#             "extracted_text": extracted_text,
#             "status": "success"
#         }
        
#     except Exception as e:
#         raise HTTPException(
#             status_code=500, 
#             detail=f"OCR failed: {str(e)}"
#         )

@app.post("/api/ocr/extract")
async def extract_text_from_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """Extract text from image using OCR"""
    _ = current_user
    if not OCR_AVAILABLE or reader is None:
        raise HTTPException(
            status_code=503,
            detail="OCR service not available"
        )
    
    try:
        # Save temporarily
        temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # Use pre-loaded reader (fast!)
        result = reader.readtext(temp_path)
        extracted_text = ' '.join([detection[1] for detection in result])
        
        # Clean up
        os.remove(temp_path)
        
        return {
            "extracted_text": extracted_text,
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR failed: {str(e)}"
        )
@app.post("/api/ocr/extract-multiple")
async def extract_text_from_multiple(
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """Extract text from multiple images"""
    _ = current_user
    if not OCR_AVAILABLE or reader is None:
        raise HTTPException(
            status_code=503,
            detail="OCR service not available"
        )
    
    results = []
    combined_text = ""
    
    for idx, file in enumerate(files):
        try:
            temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
            
            with open(temp_path, "wb") as f:
                f.write(await file.read())
            
            # Use pre-loaded reader
            result = reader.readtext(temp_path)
            extracted_text = ' '.join([detection[1] for detection in result])
            
            os.remove(temp_path)
            
            results.append({
                "filename": file.filename,
                "text": extracted_text,
                "success": True
            })
            
            combined_text += f"\n\n📷 From {file.filename}:\n{extracted_text}"
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "text": "",
                "success": False,
                "error": str(e)
            })
    
    return {
        "combined_text": combined_text.strip(),
        "results": results,
        "status": "success"
    }

# @app.post("/api/ocr/extract-multiple")
# async def extract_text_from_multiple(files: List[UploadFile] = File(...)):
#     """Extract text from multiple images"""
#     if not OCR_AVAILABLE:
#         raise HTTPException(
#             status_code=503,
#             detail="OCR service not available"
#         )
    
#     results = []
#     combined_text = ""
    
#     for idx, file in enumerate(files):
#         try:
#             # Save temporarily
#             temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
            
#             with open(temp_path, "wb") as f:
#                 f.write(await file.read())
            
#             # Extract text
#             result = reader.readtext(temp_path)
#             extracted_text = ' '.join([detection[1] for detection in result])
            
#             # Clean up
#             os.remove(temp_path)
            
#             # Add to results
#             results.append({
#                 "filename": file.filename,
#                 "text": extracted_text,
#                 "success": True
#             })
            
#             # Add to combined text
#             combined_text += f"\n\n📷 From {file.filename}:\n{extracted_text}"
            
#         except Exception as e:
#             results.append({
#                 "filename": file.filename,
#                 "text": "",
#                 "success": False,
#                 "error": str(e)
#             })
    
#     return {
#         "combined_text": combined_text.strip(),
#         "results": results,
#         "status": "success"
#     }


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
