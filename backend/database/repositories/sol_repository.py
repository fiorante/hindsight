"""
Repository for sol-related database operations.
"""

from typing import List, Optional
import pandas as pd

from .base import BaseRepository
from models import SolListItem


class SolRepository(BaseRepository):
    """Repository for sol data access."""
    
    def get_all_sols(self) -> List[SolListItem]:
        """Get list of all available sols with basic metadata."""
        query = """
        SELECT sol, distance, start_sclk, end_sclk, duration, point_count
        FROM sols 
        ORDER BY sol
        """
        
        df = self.execute_query(query)
        
        if df.empty:
            return []
        
        sols = []
        for _, row in df.iterrows():
            sols.append(SolListItem(
                sol=int(row['sol']),
                distance=float(row['distance']) if row['distance'] is not None else None,
                start_sclk=int(row['start_sclk']),
                end_sclk=int(row['end_sclk']),
                duration=float(row['duration']) if row['duration'] is not None else None,
                point_count=int(row['point_count']) if row['point_count'] is not None else None
            ))
        
        return sols
    
    def get_sol_metadata(self, sol: int) -> Optional[pd.Series]:
        """Get metadata for a specific sol."""
        query = """
        SELECT sol, distance, start_sclk, end_sclk, duration, point_count
        FROM sols 
        WHERE sol = :sol
        """
        
        df = self.execute_query(query, {"sol": sol})
        
        if df.empty:
            return None
        
        return df.iloc[0]
    
    def get_sols_for_similarity_search(self) -> pd.DataFrame:
        """Get all sols for similarity search comparison."""
        query = """
        SELECT sol, start_sclk, end_sclk, distance, duration, point_count 
        FROM sols 
        ORDER BY sol
        """
        return self.execute_query(query)
    
    def get_sols_by_sclk_range(self, start_sclk: int, end_sclk: int) -> List[int]:
        """Find which sols overlap with a given SCLK range."""
        query = """
        SELECT DISTINCT sol FROM sols 
        WHERE (start_sclk <= :end_sclk AND end_sclk >= :start_sclk)
        ORDER BY sol
        """
        df = self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
        return df['sol'].tolist() if not df.empty else []
