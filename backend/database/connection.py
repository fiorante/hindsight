"""
Database connection and session management.
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from shared.config import load_env_file, get_database_url

# Load environment variables from backend/.env
load_env_file(Path(__file__).parent.parent / '.env')

# Database configuration
DATABASE_URL = get_database_url()

# Create database engine and session factory
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_engine():
    """Get the database engine."""
    return engine
