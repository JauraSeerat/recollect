"""
Database module for Notes App
Supports both SQLite (local) and PostgreSQL (production)
"""

from databases import Database
import os
from datetime import datetime
import uuid

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

# Convert Railway's postgres:// to postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# For local development, use SQLite
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./notes.db"

IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Create database connection with connection pooling
if DATABASE_URL.startswith("postgresql"):
    database = Database(DATABASE_URL, min_size=5, max_size=20)
else:
    database = Database(DATABASE_URL)

print(f"📊 Using database: {DATABASE_URL.split('://')[0]}")


# ==================== DATABASE CONNECTION ====================

async def connect_db():
    """Connect to database on startup"""
    await database.connect()
    if IS_SQLITE:
        # SQLite requires this pragma for foreign-key constraints to work.
        await database.execute("PRAGMA foreign_keys=ON")
    print("✅ Database connected")


async def disconnect_db():
    """Disconnect from database on shutdown"""
    await database.disconnect()
    print("❌ Database disconnected")


async def create_tables():
    """Create all database tables"""
    if IS_SQLITE:
        await database.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await database.execute("""
            CREATE TABLE IF NOT EXISTS notes_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT REFERENCES users(user_id),
                content TEXT,
                title TEXT,
                subject TEXT DEFAULT 'General',
                entry_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await database.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER REFERENCES notes_entries(id) ON DELETE CASCADE,
                media_type TEXT,
                file_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        await database.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await database.execute("""
            CREATE TABLE IF NOT EXISTS notes_entries (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(user_id),
                content TEXT,
                title TEXT,
                subject TEXT DEFAULT 'General',
                entry_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await database.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id SERIAL PRIMARY KEY,
                entry_id INTEGER REFERENCES notes_entries(id) ON DELETE CASCADE,
                media_type TEXT,
                file_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    
    # Create indexes for performance
    try:
        await database.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_entries ON notes_entries(user_id)"
        )
        await database.execute(
            "CREATE INDEX IF NOT EXISTS idx_entry_date ON notes_entries(entry_date)"
        )
        await database.execute(
            "CREATE INDEX IF NOT EXISTS idx_subject ON notes_entries(subject)"
        )
    except:
        pass  # Indexes might already exist
    
    print("✅ Database tables created")


# ==================== USER OPERATIONS ====================

async def create_user(username: str, password_hash: str = None):
    """Create a new user"""
    user_id = str(uuid.uuid4())
    
    await database.execute(
        query="""
            INSERT INTO users (user_id, username, password_hash, created_at)
            VALUES (:user_id, :username, :password_hash, CURRENT_TIMESTAMP)
        """,
        values={
            "user_id": user_id,
            "username": username,
            "password_hash": password_hash
        }
    )
    return await get_user_by_id(user_id)


async def get_user_with_password(username: str):
    """Get user including password hash"""
    query = "SELECT * FROM users WHERE username = :username"
    result = await database.fetch_one(
        query=query,
        values={"username": username}
    )
    return dict(result) if result else None


async def get_user_by_username(username: str):
    """Get user by username"""
    query = """
        SELECT user_id, username, created_at
        FROM users
        WHERE username = :username
    """
    result = await database.fetch_one(
        query=query,
        values={"username": username}
    )
    return dict(result) if result else None


async def get_user_by_id(user_id: str):
    """Get user by ID"""
    query = """
        SELECT user_id, username, created_at
        FROM users
        WHERE user_id = :user_id
    """
    result = await database.fetch_one(
        query=query,
        values={"user_id": user_id}
    )
    return dict(result) if result else None


# ==================== ENTRY OPERATIONS ====================


async def create_entry(user_id: str, content: str, title: str = None, 
                      subject: str = "General", entry_date: str = None):
    """Create a new note entry"""
    
    # Convert string date to date object
    if entry_date:
        if isinstance(entry_date, str):
            entry_date = datetime.strptime(entry_date, '%Y-%m-%d').date()
    else:
        entry_date = datetime.now().date()
    
    query = """
        INSERT INTO notes_entries 
        (user_id, content, title, subject, entry_date, created_at, updated_at)
        VALUES (:user_id, :content, :title, :subject, :entry_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
    """
    
    result = await database.fetch_val(
        query=query,
        values={
            "user_id": user_id,
            "content": content,
            "title": title,
            "subject": subject,
            "entry_date": entry_date  # Now it's a date object, not string
        }
    )
    return result


async def get_user_entries(user_id: str):
    """Get all entries for a user"""
    query = """
        SELECT e.* FROM notes_entries e
        WHERE user_id = :user_id
        ORDER BY created_at DESC
    """
    
    rows = await database.fetch_all(
        query=query,
        values={"user_id": user_id}
    )
    
    # Get media for each entry
    entries = []
    for row in rows:
        entry = dict(row)
        media = await get_entry_media(entry['id'])
        entry['media_paths'] = [m['file_path'] for m in media]
        entries.append(entry)
    
    return entries


async def get_entry(entry_id: int):
    """Get a single entry by ID"""
    query = "SELECT * FROM notes_entries WHERE id = :entry_id"
    
    result = await database.fetch_one(
        query=query,
        values={"entry_id": entry_id}
    )
    
    if result:
        entry = dict(result)
        media = await get_entry_media(entry_id)
        entry['media_paths'] = [m['file_path'] for m in media]
        return entry
    
    return None


async def get_entry_owner(entry_id: int):
    """Get entry ownership information"""
    query = """
        SELECT id, user_id
        FROM notes_entries
        WHERE id = :entry_id
    """
    result = await database.fetch_one(query=query, values={"entry_id": entry_id})
    return dict(result) if result else None


async def update_entry(entry_id: int, content: str = None, 
                      title: str = None, subject: str = None):
    """Update an entry"""
    updates = []
    values = {"entry_id": entry_id}
    
    if content is not None:
        updates.append("content = :content")
        values["content"] = content
    
    if title is not None:
        updates.append("title = :title")
        values["title"] = title
    
    if subject is not None:
        updates.append("subject = :subject")
        values["subject"] = subject
    
    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        query = f"""
            UPDATE notes_entries 
            SET {', '.join(updates)}
            WHERE id = :entry_id
        """
        await database.execute(query=query, values=values)
    
    return True


async def delete_entry(entry_id: int):
    """Delete an entry (cascade deletes media)"""
    query = "DELETE FROM notes_entries WHERE id = :entry_id"
    await database.execute(query=query, values={"entry_id": entry_id})
    return True


async def search_entries(user_id: str, search_query: str):
    """Search entries by content or title"""
    query = """
        SELECT * FROM notes_entries
        WHERE user_id = :user_id
        AND (
            content LIKE :search_query
            OR title LIKE :search_query
        )
        ORDER BY created_at DESC
    """
    
    rows = await database.fetch_all(
        query=query,
        values={
            "user_id": user_id,
            "search_query": f"%{search_query}%"
        }
    )
    return [dict(row) for row in rows]


async def get_entries_by_subject(user_id: str, subject: str):
    """Get entries by subject"""
    query = """
        SELECT * FROM notes_entries
        WHERE user_id = :user_id AND subject = :subject
        ORDER BY created_at DESC
    """
    
    rows = await database.fetch_all(
        query=query,
        values={"user_id": user_id, "subject": subject}
    )
    return [dict(row) for row in rows]


async def get_user_subjects(user_id: str):
    """Get all unique subjects for a user"""
    query = """
        SELECT DISTINCT subject
        FROM notes_entries
        WHERE user_id = :user_id
        ORDER BY subject
    """
    
    rows = await database.fetch_all(
        query=query,
        values={"user_id": user_id}
    )
    return [row['subject'] for row in rows]


# ==================== MEDIA OPERATIONS ====================

async def add_media(entry_id: int, media_type: str, file_path: str):
    """Add media to an entry"""
    query = """
        INSERT INTO media (entry_id, media_type, file_path, created_at)
        VALUES (:entry_id, :media_type, :file_path, CURRENT_TIMESTAMP)
        RETURNING id
    """
    
    result = await database.fetch_val(
        query=query,
        values={
            "entry_id": entry_id,
            "media_type": media_type,
            "file_path": file_path
        }
    )
    return result


async def get_entry_media(entry_id: int):
    """Get all media for an entry"""
    query = """
        SELECT * FROM media
        WHERE entry_id = :entry_id
        ORDER BY created_at
    """
    
    rows = await database.fetch_all(
        query=query,
        values={"entry_id": entry_id}
    )
    return [dict(row) for row in rows]


# ==================== STATISTICS ====================

async def get_user_statistics(user_id: str):
    """Get statistics for a user"""
    query = """
        SELECT 
            COUNT(*) as total_entries,
            COUNT(DISTINCT subject) as total_subjects,
            COUNT(DISTINCT entry_date) as unique_days,
            COALESCE(SUM(LENGTH(COALESCE(content, ''))), 0) as total_characters
        FROM notes_entries
        WHERE user_id = :user_id
    """
    
    result = await database.fetch_one(
        query=query,
        values={"user_id": user_id}
    )
    return dict(result) if result else {
        "total_entries": 0,
        "total_subjects": 0,
        "unique_days": 0,
        "total_characters": 0
    }


def is_unique_violation(exc: Exception) -> bool:
    """Best-effort detection for unique-constraint violations across DB engines."""
    message = str(exc).lower()
    return "unique constraint" in message or "duplicate key value violates unique constraint" in message
