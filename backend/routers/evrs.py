"""
EVR (Event Record) endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session

from models import EVRRecord, EVRStreamResponse
from database.connection import get_db
from services.evr_service import EVRService

router = APIRouter(prefix="/evrs", tags=["evrs"])

@router.get("/{sol}", response_model=List[EVRRecord])
async def get_evrs_for_sol(sol: int, db: Session = Depends(get_db)):
    """
    Get EVR (Event Record) data for a specific sol.
    
    Returns all event records for the specified sol.
    Note: For large sols, prefer the streaming endpoint.
    """
    service = EVRService(db)
    return service.get_evrs_for_sol(sol)

@router.get("/{sol}/stream", response_model=EVRStreamResponse)
async def stream_evrs(
    sol: int,
    limit: int = 1000,
    cursor_sclk: Optional[int] = None,
    cursor_log: Optional[int] = None,
    dir: str = "next",
    q: Optional[str] = None,
    level: Optional[List[str]] = Query(default=None),
    module: Optional[List[str]] = Query(default=None),
    name: Optional[List[str]] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Keyset-paginated EVR stream within the sol's SCLK window."""
    service = EVRService(db)
    return service.stream_evrs(
        sol=sol,
        limit=limit,
        cursor_sclk=cursor_sclk,
        cursor_log=cursor_log,
        direction=dir,
        search_query=q,
        level_filters=level,
        module_filters=module,
        name_filters=name
    )

@router.get("/{sol}/search/nearest", response_model=Optional[EVRRecord])
async def search_nearest_evr(
    sol: int,
    from_sclk: int,
    dir: str = "next",
    q: Optional[str] = None,
    level: Optional[List[str]] = None,
    module: Optional[List[str]] = None,
    name: Optional[List[str]] = None,
    db: Session = Depends(get_db)
):
    """Return the single nearest EVR that matches filters after/before a given SCLK."""
    service = EVRService(db)
    return service.search_nearest_evr(
        sol=sol,
        from_sclk=from_sclk,
        direction=dir,
        search_query=q,
        level_filters=level,
        module_filters=module,
        name_filters=name
    )

@router.get("/{sol}/facets")
async def evr_facets(sol: int, q: Optional[str] = None, db: Session = Depends(get_db)):
    """Return facet lists for module, name, and level within sol."""
    service = EVRService(db)
    return service.get_evr_facets(sol, q)
