"""
Business logic for fault-related operations.
"""

from typing import List
from sqlalchemy.orm import Session

from models import FaultRecord
from database.repositories.fault_repository import FaultRepository


class FaultService:
    """Service for fault-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.fault_repo = FaultRepository(db)
    
    def get_faults_for_sol(self, sol: int) -> List[FaultRecord]:
        """Get fault data for a specific sol."""
        return self.fault_repo.get_faults_for_sol(sol)
