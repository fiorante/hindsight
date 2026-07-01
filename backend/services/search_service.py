"""
Business logic for search and query operations.
"""

from typing import List
from sqlalchemy.orm import Session

from models import ExplicitQueryRequest, SolListItem
from database.repositories.search_repository import SearchRepository


class SearchService:
    """Service for search-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.search_repo = SearchRepository(db)
    
    def execute_explicit_query(self, request: ExplicitQueryRequest) -> List[SolListItem]:
        """Perform explicit database query with filters."""
        return self.search_repo.execute_explicit_query(request)
