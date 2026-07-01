"""
Business logic for telemetry-related operations.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models import (
    MobilityTelemetryResponse, MotorTelemetryResponse, MotorListResponse,
    ChartDataPoint, ChartDataResponse, NearestSCLKResponse, 
    SegmentValidationResponse
)
from database.repositories.telemetry_repository import TelemetryRepository
from database.repositories.map_repository import MapRepository
from database.repositories.sol_repository import SolRepository
from parameter_config import ParameterConfig


class TelemetryService:
    """Service for telemetry-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.telemetry_repo = TelemetryRepository(db)
        self.map_repo = MapRepository(db)
        self.sol_repo = SolRepository(db)
    
    def get_mobility_telemetry(self, start_sclk: int, end_sclk: int) -> MobilityTelemetryResponse:
        """Get mobility telemetry data for a given SCLK range."""
        if start_sclk >= end_sclk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_sclk must be less than end_sclk"
            )
        
        try:
            telemetry_data = self.telemetry_repo.get_mobility_telemetry(start_sclk, end_sclk)
            
            return MobilityTelemetryResponse(
                start_sclk=start_sclk,
                end_sclk=end_sclk,
                point_count=len(telemetry_data),
                telemetry=telemetry_data
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve mobility telemetry: {str(e)}"
            )
    
    def get_motor_telemetry(
        self, 
        start_sclk: int, 
        end_sclk: int, 
        motor_names: Optional[List[str]] = None
    ) -> MotorTelemetryResponse:
        """Get motor telemetry data for a given SCLK range."""
        if start_sclk >= end_sclk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_sclk must be less than end_sclk"
            )
        
        try:
            motors_data = self.telemetry_repo.get_motor_telemetry(start_sclk, end_sclk, motor_names)
            total_points = sum(len(points) for points in motors_data.values())
            
            return MotorTelemetryResponse(
                start_sclk=start_sclk,
                end_sclk=end_sclk,
                point_count=total_points,
                motors=motors_data
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve motor telemetry: {str(e)}"
            )
    
    def get_available_motors(self) -> MotorListResponse:
        """Get list of available motor names."""
        try:
            motors = self.telemetry_repo.get_available_motors()
            
            return MotorListResponse(
                motors=motors,
                total_count=len(motors)
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve motor list: {str(e)}"
            )
    
    def get_telemetry_data(self, sol: int, parameter: str) -> ChartDataResponse:
        """Get telemetry data for a specific parameter from a sol."""
        try:
            # Get sol SCLK range
            sol_metadata = self.sol_repo.get_sol_metadata(sol)
            if sol_metadata is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No sol data found for sol {sol}"
                )
            
            start_sclk, end_sclk = sol_metadata['start_sclk'], sol_metadata['end_sclk']
            
            # Use centralized parameter configuration
            sql_query, query_params = ParameterConfig.build_query(parameter, 'data', start_sclk, end_sclk)
            
            result = self.db.execute(text(sql_query), query_params)
            telemetry_results = result.fetchall()

            # Optimized min/max calculation
            min_value, max_value = None, None
            if ParameterConfig.is_numeric(parameter):
                range_query, range_params = ParameterConfig.build_query(parameter, 'range', start_sclk, end_sclk)
                range_result = self.db.execute(text(range_query), range_params).fetchone()
                if range_result:
                    min_value, max_value = range_result.min_value, range_result.max_value
            
            # Build chart data based on parameter type
            chart_data = self._build_chart_data(telemetry_results, parameter)

            return ChartDataResponse(
                sol=sol,
                parameter=parameter,
                data=chart_data,
                min_value=min_value,
                max_value=max_value
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve telemetry data: {str(e)}"
            )
    
    def get_telemetry_range(self, sol: int, parameter: str) -> Dict[str, Any]:
        """Get just the min/max range for a parameter in a sol."""
        try:
            # Get sol SCLK range
            sol_metadata = self.sol_repo.get_sol_metadata(sol)
            if sol_metadata is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No sol data found for sol {sol}"
                )
            
            start_sclk, end_sclk = sol_metadata['start_sclk'], sol_metadata['end_sclk']
            
            # Check if parameter is numeric (can calculate min/max)
            if not ParameterConfig.is_numeric(parameter):
                # For non-numeric parameters like terrain, return null values
                return {
                    "sol": sol,
                    "parameter": parameter,
                    "min_value": None,
                    "max_value": None
                }
            
            # Use centralized parameter configuration
            sql_query, query_params = ParameterConfig.build_query(parameter, 'range', start_sclk, end_sclk)
            result = self.db.execute(text(sql_query), query_params).fetchone()
            
            return {
                "sol": sol,
                "parameter": parameter,
                "min_value": result.min_value,
                "max_value": result.max_value
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve range: {str(e)}"
            )
    
    def get_nearest_sclk(self, easting: float, northing: float) -> NearestSCLKResponse:
        """Find the nearest telemetry point to given coordinates."""
        return self.map_repo.find_nearest_sclk(easting, northing)
    
    def validate_segment(self, start_sclk: int, end_sclk: int) -> SegmentValidationResponse:
        """Validate a drive segment and return metadata."""
        if start_sclk >= end_sclk:
            return SegmentValidationResponse(
                valid=False,
                duration=0.0,
                point_count=0,
                error="Start SCLK must be less than end SCLK"
            )
        
        try:
            metadata = self.map_repo.get_segment_metadata(start_sclk, end_sclk)
            
            # Check minimum requirements (60 seconds OR 10 points)
            valid = metadata.duration >= 60.0 or metadata.point_count >= 10
            
            error = None
            if not valid:
                error = f"Segment too short: {metadata.duration:.1f} seconds (minimum 60 seconds) and {metadata.point_count} points (minimum 10 points). Try selecting a longer segment."
            
            return SegmentValidationResponse(
                valid=valid,
                duration=metadata.duration,
                point_count=metadata.point_count,
                distance=metadata.distance,
                sols_covered=metadata.sols_covered,
                error=error
            )
            
        except HTTPException as e:
            return SegmentValidationResponse(
                valid=False,
                duration=0.0,
                point_count=0,
                error=str(e.detail)
            )
    
    def _build_chart_data(self, telemetry_results, parameter: str) -> List[ChartDataPoint]:
        """Build chart data based on parameter type."""
        from parameter_config import ParameterType
        
        param_type = ParameterConfig.get_parameter_type(parameter)
        param_lower = parameter.lower()
        
        if param_type == ParameterType.MOTOR:
            chart_data = [
                ChartDataPoint(sclk=row.sclk, value=row.value)
                for row in telemetry_results
            ]
        elif param_lower == 'terrain':
            chart_data = [
                ChartDataPoint(sclk=row.sclk, value=row.terrain)
                for row in telemetry_results
            ]
        else:
            chart_data = [
                ChartDataPoint(sclk=row.sclk, value=(row.slip if param_lower == 'slip' else getattr(row, param_lower)))
                for row in telemetry_results
            ]
        
        return chart_data
