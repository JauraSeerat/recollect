"""
Notes App - Main API Server
FastAPI backend with PostgreSQL and Cloud Storage
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import database as db
import storage
import os
import uuid
from datetime import datetime

# Import OCR if available
try:
    import easyocr
    OCR_AVAILABLE = True
    reader = easyocr.Reader(['en'])
except:
    OCR_AVAILABLE = False
    print("⚠️  EasyOCR not available - OCR features disabled")

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
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== STARTUP/SHUTDOWN ====================

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
    username: str

class EntryCreate(BaseModel):
    user_id: str
    content: str
    title: Optional[str] = None
    subject: Optional[str] = "General"
    entry_date: Optional[str] = None
    image_paths: Optional[List[str]] = None

class EntryUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None


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

@app.post("/api/users/login")
async def login_user(user: UserLogin):
    """Login or create user"""
    # Check if user exists
    existing_user = await db.get_user_by_username(user.username)
    
    if existing_user:
        return existing_user
    
    # Create new user
    new_user = await db.create_user(user.username)
    return new_user


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    """Get user by ID"""
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/api/users/{user_id}/statistics")
async def get_user_stats(user_id: str):
    """Get user statistics"""
    return await db.get_user_statistics(user_id)


# ==================== ENTRY ROUTES ====================

@app.post("/api/entries")
async def create_entry(entry: EntryCreate):
    """Create a new note entry"""
    # Create entry
    entry_id = await db.create_entry(
        user_id=entry.user_id,
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
async def get_user_entries(user_id: str):
    """Get all entries for a user"""
    return await db.get_user_entries(user_id)


@app.get("/api/entries/{entry_id}")
async def get_entry(entry_id: int):
    """Get a single entry"""
    entry = await db.get_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.put("/api/entries/{entry_id}")
async def update_entry(entry_id: int, entry: EntryUpdate):
    """Update an entry"""
    await db.update_entry(
        entry_id=entry_id,
        content=entry.content,
        title=entry.title,
        subject=entry.subject
    )
    return {"status": "success"}


@app.delete("/api/entries/{entry_id}")
async def delete_entry(entry_id: int):
    """Delete an entry"""
    # Get entry to delete associated media
    entry = await db.get_entry(entry_id)
    
    if entry and entry.get('media_paths'):
        for media_path in entry['media_paths']:
            # Delete from cloud storage if enabled
            if storage.is_cloud_storage_enabled():
                storage.delete_from_cloud(media_path)
            else:
                storage.delete_from_local(media_path)
    
    # Delete entry (cascade deletes media records)
    await db.delete_entry(entry_id)
    return {"status": "success"}


@app.get("/api/users/{user_id}/entries/search")
async def search_entries(user_id: str, query: str):
    """Search entries"""
    return await db.search_entries(user_id, query)


@app.get("/api/users/{user_id}/entries/subject/{subject}")
async def get_entries_by_subject(user_id: str, subject: str):
    """Get entries by subject"""
    return await db.get_entries_by_subject(user_id, subject)


@app.get("/api/users/{user_id}/subjects")
async def get_subjects(user_id: str):
    """Get all unique subjects for a user"""
    return await db.get_user_subjects(user_id)


# ==================== UPLOAD ROUTES ====================

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = None
):
    """Upload a file (image) to cloud storage or local disk"""
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Create object name with user folder
    if user_id:
        object_name = f"{user_id}/{unique_filename}"
    else:
        object_name = unique_filename
    
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
async def get_media(user_id: str, filename: str):
    """Serve uploaded media files (for local storage only)"""
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

@app.post("/api/ocr/extract")
async def extract_text_from_image(file: UploadFile = File(...)):
    """Extract text from image using OCR"""
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="OCR service not available"
        )
    
    try:
        # Save temporarily
        temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # Extract text
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
async def extract_text_from_multiple(files: List[UploadFile] = File(...)):
    """Extract text from multiple images"""
    if not OCR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="OCR service not available"
        )
    
    results = []
    combined_text = ""
    
    for idx, file in enumerate(files):
        try:
            # Save temporarily
            temp_path = f"/tmp/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
            
            with open(temp_path, "wb") as f:
                f.write(await file.read())
            
            # Extract text
            result = reader.readtext(temp_path)
            extracted_text = ' '.join([detection[1] for detection in result])
            
            # Clean up
            os.remove(temp_path)
            
            # Add to results
            results.append({
                "filename": file.filename,
                "text": extracted_text,
                "success": True
            })
            
            # Add to combined text
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
