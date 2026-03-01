"""
Standalone OCR service for Recollect.
This service should be deployed separately from the main API.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import easyocr
import tempfile
import os
import asyncio

app = FastAPI(title="Recollect OCR Service")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

OCR_LANGUAGES = [lang.strip() for lang in os.getenv("OCR_LANGUAGES", "en").split(",") if lang.strip()]
OCR_GPU = os.getenv("OCR_GPU", "false").lower() == "true"
OCR_PRELOAD = os.getenv("OCR_PRELOAD", "true").lower() == "true"

reader = None
reader_lock = asyncio.Lock()


async def get_reader():
    global reader
    if reader is not None:
        return reader
    async with reader_lock:
        if reader is None:
            reader = easyocr.Reader(OCR_LANGUAGES, gpu=OCR_GPU)
    return reader


async def extract_text_from_upload(file: UploadFile) -> str:
    current_reader = await get_reader()
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
    file_bytes = await file.read()
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = temp_file.name
    try:
        temp_file.write(file_bytes)
        temp_file.close()
        # OCR is CPU-heavy; run in worker thread.
        result = await asyncio.to_thread(current_reader.readtext, temp_path)
        return " ".join([detection[1] for detection in result])
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


@app.on_event("startup")
async def startup():
    if OCR_PRELOAD:
        await get_reader()


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ocr_loaded": reader is not None,
        "languages": OCR_LANGUAGES,
        "gpu": OCR_GPU,
    }


@app.post("/extract")
async def extract_single(file: UploadFile = File(...)):
    try:
        extracted_text = await extract_text_from_upload(file)
        return {"extracted_text": extracted_text, "status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(exc)}")


@app.post("/extract-multiple")
async def extract_multiple(files: List[UploadFile] = File(...)):
    results = []
    combined_text = ""

    for file in files:
        try:
            extracted_text = await extract_text_from_upload(file)
            results.append({
                "filename": file.filename,
                "text": extracted_text,
                "success": True
            })
            combined_text += f"\n\nFrom {file.filename}:\n{extracted_text}"
        except Exception as exc:
            results.append({
                "filename": file.filename,
                "text": "",
                "success": False,
                "error": str(exc)
            })

    return {
        "combined_text": combined_text.strip(),
        "results": results,
        "status": "success"
    }

