"""
Sol-related endpoints for retrieving sol data, EVRs, faults, etc.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from models import SolListItem, SolData, EVRRecord, FaultRecord
from database.connection import get_db
from services.sol_service import SolService

router = APIRouter(prefix="/sols", tags=["sols"])

@router.get("/list", response_model=List[SolListItem])
async def get_sols_list(db: Session = Depends(get_db)):
    """Get list of all available sols with basic metadata."""
    service = SolService(db)
    return service.get_sols_list()

@router.get("/{sol}", response_model=SolData)
async def get_sol_data(sol: int, db: Session = Depends(get_db)):
    """Get complete data for a specific sol including telemetry and EVRs."""
    service = SolService(db)
    sol_data = service.get_sol_data(sol)
    
    if sol_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sol {sol} not found"
        )
    
    return sol_data
