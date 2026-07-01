"""
Repository for search and query operations.
"""

import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status

from .base import BaseRepository
from models import ExplicitQueryRequest, SolListItem


class SearchRepository(BaseRepository):
    """Repository for search and explicit query operations."""
    
    def execute_explicit_query(self, request: ExplicitQueryRequest) -> List[SolListItem]:
        """Execute explicit database query with filters."""
        try:
            # Define which fields belong to which table
            sols_fields = {'sol', 'distance', 'start_sclk', 'end_sclk', 'duration', 'point_count'}
            telemetry_fields = {'easting', 'northing', 'elevation', 'slope', 'heading', 'velocity', 'terrain'}
            slip_fields = {'slip'}
            fault_fields = {'fault'}
            
            # Check if we need to join with other tables
            needs_telemetry_join = any(
                filter_item.field in telemetry_fields 
                for filter_item in request.filters
            )
            needs_slip_join = any(
                filter_item.field in slip_fields
                for filter_item in request.filters
            )
            needs_fault_join = any(
                filter_item.field in fault_fields
                for filter_item in request.filters
            )
            
            # Consider ordering fields for join needs as well
            order_by_field = request.order_by if request.order_by else None
            if order_by_field in telemetry_fields:
                needs_telemetry_join = True
            if order_by_field in slip_fields:
                needs_slip_join = True

            # Build base query
            base_query = self._build_base_query(needs_telemetry_join, needs_slip_join, needs_fault_join)
            
            # Build WHERE clauses from filters
            where_clauses, params = self._build_where_clauses(request)
            
            # Construct final query
            if where_clauses:
                query = base_query + " WHERE " + " AND ".join(where_clauses)
            else:
                query = base_query
            
            # Add ordering
            query = self._add_ordering(query, request, telemetry_fields, slip_fields, fault_fields)
            
            # Add limit
            query += f" LIMIT {request.limit}"
            
            # Execute query
            df = self.execute_query(query, params)
            
            # Convert to response format
            return self._convert_to_sol_list_items(df)
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Explicit query failed: {str(e)}"
            )
    
    def _build_base_query(self, needs_telemetry_join: bool, needs_slip_join: bool, needs_fault_join: bool) -> str:
        """Build the base SQL query with appropriate joins."""
        base_query = """
        SELECT DISTINCT s.sol, s.distance, s.start_sclk, s.end_sclk, s.duration, s.point_count
        FROM sols s
        """
        if needs_telemetry_join:
            base_query += "\nINNER JOIN drive_telemetry dt ON dt.sclk >= s.start_sclk AND dt.sclk <= s.end_sclk"
        if needs_slip_join:
            base_query += "\nINNER JOIN slip_telemetry st ON st.sclk >= s.start_sclk AND st.sclk <= s.end_sclk"
        if needs_fault_join:
            base_query += "\nINNER JOIN faults f ON f.sol = s.sol"
        return base_query
    
    def _build_where_clauses(self, request: ExplicitQueryRequest) -> tuple[List[str], Dict[str, Any]]:
        """Build WHERE clauses and parameters from filters."""
        where_clauses = []
        params = {}
        
        # Handle sol range filter
        if request.sol_range:
            where_clauses.append("s.sol BETWEEN :min_sol AND :max_sol")
            params["min_sol"] = request.sol_range[0]
            params["max_sol"] = request.sol_range[1]
        
        # Handle field filters
        for i, filter_item in enumerate(request.filters):
            param_name = f"filter_{i}"
            
            # Handle terrain-specific operators separately
            if filter_item.field == "terrain" and filter_item.operator in ["primarily", "includes", "does_not_include"]:
                clause = self._build_terrain_clause(filter_item, param_name)
                where_clauses.append(clause)
                params[param_name] = filter_item.value
                
            elif filter_item.field == "fault":
                clause = self._build_fault_clause(filter_item, param_name)
                where_clauses.append(clause)
                if filter_item.value != "ANY":
                    params[param_name] = filter_item.value
                    
            else:
                # Handle regular operators for all other fields
                clause, param_dict = self._build_regular_clause(filter_item, param_name)
                where_clauses.append(clause)
                params.update(param_dict)
        
        return where_clauses, params
    
    def _build_terrain_clause(self, filter_item, param_name: str) -> str:
        """Build terrain-specific WHERE clause."""
        if filter_item.operator == "primarily":
            return f"""
            s.sol IN (
                SELECT sol_with_terrain 
                FROM (
                    SELECT s2.sol as sol_with_terrain, dt2.terrain, COUNT(*) as terrain_count,
                           ROW_NUMBER() OVER (PARTITION BY s2.sol ORDER BY COUNT(*) DESC) as rn
                    FROM sols s2
                    INNER JOIN drive_telemetry dt2 ON dt2.sclk >= s2.start_sclk AND dt2.sclk <= s2.end_sclk
                    WHERE dt2.terrain IS NOT NULL
                    GROUP BY s2.sol, dt2.terrain
                ) ranked_terrain
                WHERE rn = 1 AND terrain = :{param_name}
            )
            """
        elif filter_item.operator == "includes":
            return f"""
            s.sol IN (
                SELECT DISTINCT s2.sol
                FROM sols s2
                INNER JOIN drive_telemetry dt2 ON dt2.sclk >= s2.start_sclk AND dt2.sclk <= s2.end_sclk
                WHERE dt2.terrain = :{param_name}
            )
            """
        elif filter_item.operator == "does_not_include":
            return f"""
            s.sol NOT IN (
                SELECT DISTINCT s2.sol
                FROM sols s2
                INNER JOIN drive_telemetry dt2 ON dt2.sclk >= s2.start_sclk AND dt2.sclk <= s2.end_sclk
                WHERE dt2.terrain = :{param_name}
            )
            """
    
    def _build_fault_clause(self, filter_item, param_name: str) -> str:
        """Build fault-specific WHERE clause."""
        if filter_item.operator == "includes":
            if filter_item.value == "ANY":
                return f"""
                s.sol IN (
                    SELECT DISTINCT f2.sol
                    FROM faults f2
                )
                """
            else:
                return f"""
                s.sol IN (
                    SELECT DISTINCT f2.sol
                    FROM faults f2
                    WHERE f2.fault_type = :{param_name}
                )
                """
        elif filter_item.operator == "does_not_include":
            if filter_item.value == "ANY":
                return f"""
                s.sol NOT IN (
                    SELECT DISTINCT f2.sol
                    FROM faults f2
                )
                """
            else:
                return f"""
                s.sol NOT IN (
                    SELECT DISTINCT f2.sol
                    FROM faults f2
                    WHERE f2.fault_type = :{param_name}
                )
                """
        elif filter_item.operator == "eq":
            if filter_item.value == "ANY":
                return "f.fault_type IS NOT NULL"
            else:
                return f"f.fault_type = :{param_name}"
    
    def _build_regular_clause(self, filter_item, param_name: str) -> tuple[str, Dict[str, Any]]:
        """Build regular WHERE clause for standard operators."""
        # Determine table prefix
        telemetry_fields = {'easting', 'northing', 'elevation', 'slope', 'heading', 'velocity', 'terrain'}
        slip_fields = {'slip'}
        fault_fields = {'fault'}
        
        if filter_item.field in telemetry_fields:
            table_prefix = "dt"
        elif filter_item.field in slip_fields:
            table_prefix = "st"
        elif filter_item.field in fault_fields:
            table_prefix = "f"
        else:
            table_prefix = "s"
        
        params = {}
        
        if filter_item.operator == "eq":
            clause = f"{table_prefix}.{filter_item.field} = :{param_name}"
            params[param_name] = filter_item.value
        elif filter_item.operator == "gt":
            clause = f"{table_prefix}.{filter_item.field} > :{param_name}"
            params[param_name] = filter_item.value
        elif filter_item.operator == "lt":
            clause = f"{table_prefix}.{filter_item.field} < :{param_name}"
            params[param_name] = filter_item.value
        elif filter_item.operator == "gte":
            clause = f"{table_prefix}.{filter_item.field} >= :{param_name}"
            params[param_name] = filter_item.value
        elif filter_item.operator == "lte":
            clause = f"{table_prefix}.{filter_item.field} <= :{param_name}"
            params[param_name] = filter_item.value
        elif filter_item.operator == "in":
            if isinstance(filter_item.value, list):
                placeholders = ", ".join([f":{param_name}_{j}" for j in range(len(filter_item.value))])
                clause = f"{table_prefix}.{filter_item.field} IN ({placeholders})"
                for j, val in enumerate(filter_item.value):
                    params[f"{param_name}_{j}"] = val
        elif filter_item.operator == "like":
            clause = f"{table_prefix}.{filter_item.field} LIKE :{param_name}"
            params[param_name] = f"%{filter_item.value}%"
        
        return clause, params
    
    def _add_ordering(self, query: str, request: ExplicitQueryRequest, telemetry_fields: set, slip_fields: set, fault_fields: set) -> str:
        """Add ORDER BY clause to query."""
        if request.order_by:
            sols_fields = {'sol', 'distance', 'start_sclk', 'end_sclk', 'duration', 'point_count'}
            all_valid_fields = sols_fields | telemetry_fields | slip_fields | fault_fields
            if request.order_by not in all_valid_fields:
                raise ValueError(f"Invalid order_by field: {request.order_by!r}")
            order_direction = "DESC" if request.order_desc else "ASC"
            if request.order_by in telemetry_fields:
                order_prefix = "dt"
            elif request.order_by in slip_fields:
                order_prefix = "st"
            elif request.order_by in fault_fields:
                order_prefix = "f"
            else:
                order_prefix = "s"
            query += f" ORDER BY {order_prefix}.{request.order_by} {order_direction}"
        else:
            query += " ORDER BY s.sol"

        return query
    
    def _convert_to_sol_list_items(self, df: pd.DataFrame) -> List[SolListItem]:
        """Convert DataFrame to list of SolListItem objects."""
        results = []
        for _, row in df.iterrows():
            results.append(SolListItem(
                sol=int(row['sol']),
                distance=float(row['distance']) if row['distance'] is not None else None,
                start_sclk=int(row['start_sclk']),
                end_sclk=int(row['end_sclk']),
                duration=float(row['duration']) if row['duration'] is not None else None,
                point_count=int(row['point_count']) if row['point_count'] is not None else None
            ))
        return results
