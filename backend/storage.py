"""
Cloud Storage Module - Cloudflare R2
Handles image uploads to cloud storage
"""

import boto3
import os
from botocore.exceptions import ClientError
import mimetypes

# Cloudflare R2 configuration from environment variables
R2_ENDPOINT = os.getenv('R2_ENDPOINT')
R2_ACCESS_KEY = os.getenv('R2_ACCESS_KEY_ID')
R2_SECRET_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
R2_BUCKET = os.getenv('R2_BUCKET', 'notes-app-uploads')
R2_PUBLIC_URL = os.getenv('R2_PUBLIC_URL')  # Your custom domain or R2 public URL

# Check if R2 is configured
R2_ENABLED = all([R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY])

if R2_ENABLED:
    # Create S3 client (R2 is S3-compatible)
    s3_client = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name='auto'
    )
    print("✅ Cloudflare R2 storage enabled")
else:
    s3_client = None
    print("⚠️  R2 not configured - using local storage")


def upload_to_cloud(file_bytes: bytes, object_name: str, content_type: str = None) -> str:
    """
    Upload file to Cloudflare R2
    
    Args:
        file_bytes: File content as bytes
        object_name: Path in bucket (e.g., 'user123/image.jpg')
        content_type: MIME type (auto-detected if None)
    
    Returns:
        Public URL of uploaded file
    """
    if not R2_ENABLED:
        raise Exception("R2 storage not configured")
    
    if not content_type:
        content_type = get_content_type(object_name)
    
    try:
        # Upload to R2
        s3_client.put_object(
            Bucket=R2_BUCKET,
            Key=object_name,
            Body=file_bytes,
            ContentType=content_type
        )
        
        # Return public URL
        if R2_PUBLIC_URL:
            public_url = f"{R2_PUBLIC_URL}/{object_name}"
        else:
            public_url = f"{R2_ENDPOINT}/{R2_BUCKET}/{object_name}"
        
        print(f"✅ Uploaded to R2: {object_name}")
        return public_url
        
    except ClientError as e:
        print(f"❌ Error uploading to R2: {e}")
        raise


def delete_from_cloud(object_name: str) -> bool:
    """
    Delete file from R2
    
    Args:
        object_name: Path in bucket or full URL
    
    Returns:
        True if successful
    """
    if not R2_ENABLED:
        return False
    
    try:
        # Extract object name from URL if needed
        if object_name.startswith('http'):
            # Extract path from URL
            parts = object_name.split(f"{R2_BUCKET}/")
            if len(parts) > 1:
                object_name = parts[1]
        
        s3_client.delete_object(
            Bucket=R2_BUCKET,
            Key=object_name
        )
        print(f"✅ Deleted from R2: {object_name}")
        return True
        
    except ClientError as e:
        print(f"❌ Error deleting from R2: {e}")
        return False


def get_content_type(filename: str) -> str:
    """Get MIME type from filename"""
    content_type, _ = mimetypes.guess_type(filename)
    return content_type or 'application/octet-stream'


def list_files(prefix: str = '', max_keys: int = 100) -> list:
    """
    List files in R2 bucket
    
    Args:
        prefix: Filter by prefix (e.g., 'user123/')
        max_keys: Maximum number of files to return
    
    Returns:
        List of file keys
    """
    if not R2_ENABLED:
        return []
    
    try:
        response = s3_client.list_objects_v2(
            Bucket=R2_BUCKET,
            Prefix=prefix,
            MaxKeys=max_keys
        )
        return [obj['Key'] for obj in response.get('Contents', [])]
    except ClientError as e:
        print(f"❌ Error listing files: {e}")
        return []


def is_cloud_storage_enabled() -> bool:
    """Check if cloud storage is enabled"""
    return R2_ENABLED


# ==================== LOCAL STORAGE FALLBACK ====================

LOCAL_UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

def save_to_local(file_bytes: bytes, file_path: str) -> str:
    """
    Save file to local disk (fallback when R2 not configured)
    
    Args:
        file_bytes: File content
        file_path: Relative path (e.g., 'user123/image.jpg')
    
    Returns:
        Local file path
    """
    full_path = os.path.join(LOCAL_UPLOAD_DIR, file_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    with open(full_path, 'wb') as f:
        f.write(file_bytes)
    
    print(f"✅ Saved locally: {full_path}")
    return full_path


def delete_from_local(file_path: str) -> bool:
    """Delete file from local disk"""
    try:
        full_path = os.path.join(LOCAL_UPLOAD_DIR, file_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"✅ Deleted locally: {full_path}")
            return True
    except Exception as e:
        print(f"❌ Error deleting local file: {e}")
    return False