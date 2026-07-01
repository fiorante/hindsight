"""
Repository for map and coordinate-related database operations.
"""

import pandas as pd
from typing import Optional
from fastapi import HTTPException, status

from .base import BaseRepository
from models import NearestSCLKResponse, SegmentMetadata


class MapRepository(BaseRepository):
    """Repository for map and coordinate data access."""
    
    def find_nearest_sclk(self, easting: float, northing: float) -> Optional[NearestSCLKResponse]:
        """Find the nearest telemetry point to given coordinates (within 10m)."""
        query = """
        SELECT sclk, easting, northing, elevation, terrain,
               SQRT(POWER(easting - :target_easting, 2) + POWER(northing - :target_northing, 2)) as distance
        FROM drive_telemetry 
        WHERE easting IS NOT NULL AND northing IS NOT NULL
        ORDER BY distance
        LIMIT 1
        """
        
        df = self.execute_query(query, {"target_easting": easting, "target_northing": northing})
        
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No telemetry points found"
            )
        
        row = df.iloc[0]
        distance = float(row['distance'])
        
        # Check 10m tolerance
        if distance > 10.0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nearest point is {distance:.1f}m away (max 10m allowed)"
            )
        
        return NearestSCLKResponse(
            sclk=int(row['sclk']),
            distance=distance,
            easting=float(row['easting']),
            northing=float(row['northing']),
            elevation=float(row['elevation']) if pd.notna(row['elevation']) else None,
            terrain=row['terrain'] if pd.notna(row['terrain']) else None
        )
    
    def get_segment_metadata(self, start_sclk: int, end_sclk: int) -> SegmentMetadata:
        """Calculate metadata for a drive segment."""
        # Get telemetry for the segment
        telemetry_df = self._get_segment_telemetry_for_metadata(start_sclk, end_sclk)
        
        if telemetry_df.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No telemetry data found for SCLK range {start_sclk}-{end_sclk}"
            )
        
        # Calculate duration
        duration = float(end_sclk - start_sclk)
        point_count = len(telemetry_df)
        
        # Calculate distance (sum of consecutive point distances)
        distance = self._calculate_segment_distance(telemetry_df)
        
        # Find which sols this segment covers
        sols_covered = self._get_sols_for_segment(start_sclk, end_sclk)
        
        return SegmentMetadata(
            start_sclk=start_sclk,
            end_sclk=end_sclk,
            duration=duration,
            point_count=point_count,
            distance=distance,
            sols_covered=sols_covered
        )
    
    def _get_segment_telemetry_for_metadata(self, start_sclk: int, end_sclk: int) -> pd.DataFrame:
        """Get telemetry data for segment metadata calculation."""
        query = """
        SELECT sclk, easting, northing, elevation, slope, heading, velocity, terrain
        FROM drive_telemetry 
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk 
        ORDER BY sclk
        """
        return self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
    
    def _calculate_segment_distance(self, telemetry_df: pd.DataFrame) -> Optional[float]:
        """Calculate total distance traveled in a segment."""
        distance = None
        if len(telemetry_df) > 1 and 'easting' in telemetry_df.columns and 'northing' in telemetry_df.columns:
            distances = []
            for i in range(1, len(telemetry_df)):
                prev_row = telemetry_df.iloc[i-1]
                curr_row = telemetry_df.iloc[i]
                
                if pd.notna(prev_row['easting']) and pd.notna(prev_row['northing']) and \
                   pd.notna(curr_row['easting']) and pd.notna(curr_row['northing']):
                    dist = ((curr_row['easting'] - prev_row['easting'])**2 + 
                           (curr_row['northing'] - prev_row['northing'])**2)**0.5
                    distances.append(dist)
            
            if distances:
                distance = sum(distances)
        
        return distance
    
    def _get_sols_for_segment(self, start_sclk: int, end_sclk: int) -> list[int]:
        """Find which sols a segment covers."""
        sols_query = """
        SELECT DISTINCT sol FROM sols 
        WHERE (start_sclk <= :end_sclk AND end_sclk >= :start_sclk)
        ORDER BY sol
        """
        sols_df = self.execute_query(sols_query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
        return sols_df['sol'].tolist() if not sols_df.empty else []
