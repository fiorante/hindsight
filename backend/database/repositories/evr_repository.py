"""
Repository for EVR (Event Record) database operations.
"""

import pandas as pd
from typing import List, Optional

from .base import BaseRepository


class EVRRepository(BaseRepository):
    """Repository for EVR data access."""
    
    def get_evrs_for_sclk_range(self, start_sclk: int, end_sclk: int) -> pd.DataFrame:
        """Get EVR data for a specific SCLK range."""
        query = """
        SELECT log_num, sclk, module, message, name, event_id, level
        FROM evrs 
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk 
        ORDER BY sclk
        """
        return self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
    
    def get_evrs_for_sol(self, sol: int) -> pd.DataFrame:
        """Get EVR data for a specific sol."""
        query = """
        SELECT e.log_num, e.sclk, e.module, e.message, e.name, e.event_id, e.level
        FROM evrs e
        JOIN sols s ON e.sclk >= s.start_sclk AND e.sclk <= s.end_sclk
        WHERE s.sol = :sol
        ORDER BY e.sclk
        """
        return self.execute_query(query, {"sol": sol})
    
    def get_evrs_stream(
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
    ) -> pd.DataFrame:
        """Get EVRs with keyset pagination and filtering."""
        
        # Get sol bounds first
        sol_bounds_query = "SELECT start_sclk, end_sclk FROM sols WHERE sol = :sol"
        sol_df = self.execute_query(sol_bounds_query, {"sol": sol})
        
        if sol_df.empty:
            return pd.DataFrame()
        
        start_sclk = int(sol_df.iloc[0]["start_sclk"])
        end_sclk = int(sol_df.iloc[0]["end_sclk"])
        
        # Build where clauses
        clauses = ["e.sclk >= :start_sclk", "e.sclk <= :end_sclk"]
        params = {"start_sclk": start_sclk, "end_sclk": end_sclk, "limit": limit + 1}

        # Filters
        if level_filters:
            clauses.append("e.level = ANY(:levels)")
            params["levels"] = level_filters
        if module_filters:
            clauses.append("e.module = ANY(:modules)")
            params["modules"] = module_filters
        if name_filters:
            clauses.append("e.name = ANY(:names)")
            params["names"] = name_filters
        if search_query:
            clauses.append("(e.message ILIKE :q OR e.module ILIKE :q OR e.name ILIKE :q)")
            params["q"] = f"%{search_query}%"

        # Keyset pagination
        order_dir = "ASC" if direction == "next" else "DESC"
        if cursor_sclk is not None and cursor_log is not None:
            if direction == "next":
                clauses.append("(e.sclk, e.log_num) > (:cursor_sclk, :cursor_log)")
            else:
                clauses.append("(e.sclk, e.log_num) < (:cursor_sclk, :cursor_log)")
            params["cursor_sclk"] = cursor_sclk
            params["cursor_log"] = cursor_log

        where_sql = " AND ".join(clauses)
        query = f"""
            SELECT e.log_num, e.sclk, e.module, e.message, e.name, e.event_id, e.level
            FROM evrs e
            WHERE {where_sql}
            ORDER BY e.sclk {order_dir}, e.log_num {order_dir}
            LIMIT :limit
        """
        
        return self.execute_query(query, params)
    
    def get_evr_facets(self, sol: int, search_query: Optional[str] = None) -> dict:
        """Get facet counts for EVR filtering."""
        
        # Get sol bounds
        sol_bounds_query = "SELECT start_sclk, end_sclk FROM sols WHERE sol = :sol"
        sol_df = self.execute_query(sol_bounds_query, {"sol": sol})
        
        if sol_df.empty:
            return {"modules": [], "names": [], "levels": []}
        
        start_sclk = int(sol_df.iloc[0]["start_sclk"])
        end_sclk = int(sol_df.iloc[0]["end_sclk"])
        
        base_where = "e.sclk >= :start_sclk AND e.sclk <= :end_sclk"
        params = {"start_sclk": start_sclk, "end_sclk": end_sclk}
        
        if search_query:
            base_where += " AND (e.message ILIKE :q OR e.module ILIKE :q OR e.name ILIKE :q)"
            params["q"] = f"%{search_query}%"

        def facet_query(field: str) -> pd.DataFrame:
            qtxt = f"""
                SELECT {field} as value, COUNT(*) as count
                FROM evrs e
                WHERE {base_where}
                GROUP BY {field}
                ORDER BY count DESC
                LIMIT 200
            """
            return self.execute_query(qtxt, params)

        modules_df = facet_query("e.module")
        names_df = facet_query("e.name")
        levels_df = facet_query("e.level")

        def to_facets(df: pd.DataFrame) -> List[dict]:
            items = []
            if df is None or df.empty:
                return items
            for _, r in df.iterrows():
                if pd.isna(r['value']):
                    continue
                items.append({"value": str(r['value']), "count": int(r['count'])})
            return items

        return {
            "modules": to_facets(modules_df),
            "names": to_facets(names_df),
            "levels": to_facets(levels_df),
        }
