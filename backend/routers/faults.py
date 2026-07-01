"""
Fault endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models import FaultRecord
from database.connection import get_db
from services.fault_service import FaultService

router = APIRouter(prefix="/faults", tags=["faults"])

@router.get("/{sol}", response_model=List[FaultRecord])
async def get_faults_for_sol(sol: int, db: Session = Depends(get_db)):
    """
    Get fault data for a specific sol.
    
    Returns all mobility faults for the specified sol.
    """
    service = FaultService(db)
    return service.get_faults_for_sol(sol)
