"""
Search and query endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import (
    SimilarityRequest, SimilaritySearchResponse, 
    ExplicitQueryRequest, SolListItem
)
from database.connection import get_db
from services.similarity_service import SimilarityService
from services.search_service import SearchService

router = APIRouter(prefix="/query", tags=["search"])

@router.post("/similar", response_model=SimilaritySearchResponse)
async def similarity_search(request: SimilarityRequest, db: Session = Depends(get_db)):
    """Perform similarity search to find segments similar to a reference."""
    service = SimilarityService(db)
    return service.perform_similarity_search(request)

@router.post("/explicit", response_model=List[SolListItem])
async def explicit_query(request: ExplicitQueryRequest, db: Session = Depends(get_db)):
    """Perform explicit database query with filters."""
    service = SearchService(db)
    return service.execute_explicit_query(request)
