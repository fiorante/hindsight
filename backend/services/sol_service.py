"""
Business logic for sol-related operations.
"""

from typing import List, Optional
import pandas as pd
from sqlalchemy.orm import Session

from models import SolListItem, SolData, TelemetryPoint, EVRRecord, SolPDI
from database.repositories.sol_repository import SolRepository
from database.repositories.telemetry_repository import TelemetryRepository
from database.repositories.evr_repository import EVRRepository
from .image_service import ImageService


class SolService:
    """Service for sol-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.sol_repo = SolRepository(db)
        self.telemetry_repo = TelemetryRepository(db)
        self.evr_repo = EVRRepository(db)
    def get_sols_list(self) -> List[SolListItem]:
        """Get list of all available sols with basic metadata."""
        return self.sol_repo.get_all_sols()
    
    def get_sol_data(self, sol: int) -> Optional[SolData]:
        """Get complete data for a specific sol including telemetry and EVRs."""
        # Get sol metadata
        sol_metadata = self.sol_repo.get_sol_metadata(sol)
        
        if sol_metadata is None:
            return None
        
        # Get telemetry data for this sol's SCLK range
        start_sclk = int(sol_metadata['start_sclk'])
        end_sclk = int(sol_metadata['end_sclk'])
        
        telemetry_df = self.telemetry_repo.get_drive_telemetry(start_sclk, end_sclk)
        telemetry_points = self._convert_telemetry_to_points(telemetry_df)
        
        # Get EVR data for this sol's SCLK range
        evr_df = self.evr_repo.get_evrs_for_sclk_range(start_sclk, end_sclk)
        evr_records = self._convert_evrs_to_records(evr_df)
        
        # Get PDI data for this sol
        from services.image_service import ImageService
        image_service = ImageService(self.db)
        pdi_data = image_service.get_sol_pdi(sol)
        
        return SolData(
            sol=int(sol_metadata['sol']),
            distance=float(sol_metadata['distance']) if sol_metadata['distance'] is not None else None,
            start_sclk=start_sclk,
            end_sclk=end_sclk,
            duration=float(sol_metadata['duration']) if sol_metadata['duration'] is not None else None,
            point_count=int(sol_metadata['point_count']) if sol_metadata['point_count'] is not None else None,
            telemetry=telemetry_points,
            evrs=evr_records,
            pdi=pdi_data
        )
    
    def _convert_telemetry_to_points(self, df: pd.DataFrame) -> List[TelemetryPoint]:
        """Convert telemetry DataFrame to TelemetryPoint objects."""
        points = []
        for _, row in df.iterrows():
            points.append(TelemetryPoint(
                sclk=int(row['sclk']),
                easting=float(row['easting']) if pd.notna(row['easting']) else None,
                northing=float(row['northing']) if pd.notna(row['northing']) else None,
                elevation=float(row['elevation']) if pd.notna(row['elevation']) else None,
                slope=float(row['slope']) if pd.notna(row['slope']) else None,
                heading=float(row['heading']) if pd.notna(row['heading']) else None,
                velocity=float(row['velocity']) if pd.notna(row['velocity']) else None,
                terrain=row['terrain'] if pd.notna(row['terrain']) else None
            ))
        return points
    
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
