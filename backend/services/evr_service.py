"""
Business logic for EVR (Event Record) operations.
"""

from typing import List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from models import EVRRecord, EVRStreamResponse, FacetItem
from database.repositories.evr_repository import EVRRepository


class EVRService:
    """Service for EVR-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.evr_repo = EVRRepository(db)
    
    def get_evrs_for_sol(self, sol: int) -> List[EVRRecord]:
        """Get EVR data for a specific sol."""
        evr_df = self.evr_repo.get_evrs_for_sol(sol)
        return self._convert_evrs_to_records(evr_df)
    
    def stream_evrs(
        self,
        sol: int,
        limit: int = 1000,
        cursor_sclk: Optional[int] = None,
        cursor_log: Optional[int] = None,
        direction: str = "next",
        search_query: Optional[str] = None,
        level_filters: Optional[List[str]] = None,
        module_filters: Optional[List[str]] = None,
        name_filters: Optional[List[str]] = None,
    ) -> EVRStreamResponse:
        """Get EVRs with keyset pagination and filtering."""
        
        df = self.evr_repo.get_evrs_stream(
            sol=sol,
            limit=limit,
            cursor_sclk=cursor_sclk,
            cursor_log=cursor_log,
            direction=direction,
            search_query=search_query,
            level_filters=level_filters,
            module_filters=module_filters,
            name_filters=name_filters
        )
        
        if df.empty:
            return EVRStreamResponse(items=[], total_returned=0)

        # Trim to limit and compute cursors
        trimmed = df.iloc[:limit]
        items = self._convert_evrs_to_records(trimmed)

        # Cursors
        next_cursor_sclk = None
        next_cursor_log = None
        prev_cursor_sclk = None
        prev_cursor_log = None

        if len(df) > len(trimmed):
            # There is more in the direction queried
            last_row = trimmed.iloc[-1]
            if direction == 'next':
                next_cursor_sclk = int(last_row['sclk'])
                next_cursor_log = int(last_row['log_num'])
            else:
                prev_cursor_sclk = int(last_row['sclk'])
                prev_cursor_log = int(last_row['log_num'])

        # If we provided DESC order, maintain ascending order in response for UI
        if direction == 'prev':
            items.reverse()

        return EVRStreamResponse(
            items=items,
            next_cursor_sclk=next_cursor_sclk,
            next_cursor_log=next_cursor_log,
            prev_cursor_sclk=prev_cursor_sclk,
            prev_cursor_log=prev_cursor_log,
            total_returned=len(items),
        )
    
    def search_nearest_evr(
        self,
        sol: int,
        from_sclk: int,
        direction: str = "next",
        search_query: Optional[str] = None,
        level_filters: Optional[List[str]] = None,
        module_filters: Optional[List[str]] = None,
        name_filters: Optional[List[str]] = None,
    ) -> Optional[EVRRecord]:
        """Return the single nearest EVR that matches filters after/before a given SCLK."""
        
        # Use stream method with limit 1 to get nearest
        df = self.evr_repo.get_evrs_stream(
            sol=sol,
            limit=1,
            cursor_sclk=from_sclk,
            cursor_log=None,
            direction=direction,
            search_query=search_query,
            level_filters=level_filters,
            module_filters=module_filters,
            name_filters=name_filters
        )
        
        if df.empty:
            return None
        
        records = self._convert_evrs_to_records(df)
        return records[0] if records else None
    
    def get_evr_facets(self, sol: int, search_query: Optional[str] = None) -> dict:
        """Get facet counts for EVR filtering."""
        facets_data = self.evr_repo.get_evr_facets(sol, search_query)
        
        return {
            "modules": [FacetItem(value=item["value"], count=item["count"]) for item in facets_data["modules"]],
            "names": [FacetItem(value=item["value"], count=item["count"]) for item in facets_data["names"]],
            "levels": [FacetItem(value=item["value"], count=item["count"]) for item in facets_data["levels"]],
        }
    
    def _convert_evrs_to_records(self, df: pd.DataFrame) -> List[EVRRecord]:
        """Convert EVR DataFrame to EVRRecord objects."""
        records = []
        for _, row in df.iterrows():
            records.append(EVRRecord(
                log_num=int(row['log_num']),
                sclk=int(row['sclk']),
                module=row['module'] if pd.notna(row['module']) else None,
                message=str(row['message']),
                name=row['name'] if pd.notna(row['name']) else None,
                event_id=int(row['event_id']) if pd.notna(row['event_id']) else None,
                level=row['level'] if 'level' in row and pd.notna(row['level']) else None,
            ))
        return records
