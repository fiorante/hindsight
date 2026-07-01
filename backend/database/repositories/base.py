"""
Base repository class with common database operations.
"""

import pandas as pd
from typing import Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status


class BaseRepository:
    """Base repository with common database operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def execute_query(self, query: str, params: Dict[str, Any] = None) -> pd.DataFrame:
        """Execute SQL query and return results as DataFrame."""
        try:
            result = self.db.execute(text(query), params or {})
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
            return df
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database query failed: {str(e)}"
            )
    
    def execute_scalar(self, query: str, params: Dict[str, Any] = None) -> Any:
        """Execute SQL query and return a scalar result."""
        try:
            result = self.db.execute(text(query), params or {})
            return result.scalar()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database query failed: {str(e)}"
            )
