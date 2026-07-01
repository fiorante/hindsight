"""
Repository for fault-related database operations.
"""

import logging
import pandas as pd
from typing import List
from fastapi import HTTPException, status

from .base import BaseRepository
from models import FaultRecord

logger = logging.getLogger(__name__)


class FaultRepository(BaseRepository):
    """Repository for fault data access."""

    def get_faults_for_sclk_range(self, start_sclk: int, end_sclk: int) -> List[str]:
        """Get ordered fault types within an SCLK range."""
        query = """
        SELECT fault_type FROM faults
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk
        ORDER BY sclk
        """
        try:
            df = self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
            return list(df['fault_type']) if not df.empty else []
        except Exception:
            return []

    def get_faults_for_sol(self, sol: int) -> List[FaultRecord]:
        """Get fault data for a specific sol."""
        # First check if the sol exists in the database
        sol_check_query = """
        SELECT sol FROM sols WHERE sol = :sol
        """
        
        try:
            sol_df = self.execute_query(sol_check_query, {"sol": sol})
            if sol_df.empty:
                # Sol doesn't exist in the database
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Sol {sol} not found"
                )
        except HTTPException:
            # Re-raise HTTPException
            raise
        except Exception as e:
            logger.error("Error checking if sol %d exists: %s", sol, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while checking sol {sol}"
            )
        
        # Now get fault data for the sol
        query = """
        SELECT f.sclk, f.fault_type
        FROM faults f
        WHERE f.sol = :sol
        ORDER BY f.sclk
        """
        
        try:
            df = self.execute_query(query, {"sol": sol})
            if df.empty:
                # Sol exists but has no faults, return empty list
                return []
            
            faults = []
            for _, row in df.iterrows():
                fault = FaultRecord(
                    sclk=int(row['sclk']),
                    fault_type=row['fault_type'],
                )
                faults.append(fault)
            
            return faults
        except Exception as e:
            logger.error("Error retrieving fault data for sol %d: %s", sol, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while retrieving fault data for sol {sol}"
            )
