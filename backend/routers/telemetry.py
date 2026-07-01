"""
Telemetry-related endpoints.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.orm import Session

from models import (
    MobilityTelemetryResponse, MotorTelemetryResponse, MotorListResponse,
    ChartDataResponse, NearestSCLKResponse, SegmentValidationResponse
)
from database.connection import get_db
from services.telemetry_service import TelemetryService

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

@router.get("/mobility", response_model=MobilityTelemetryResponse)
async def get_segment_mobility_telemetry(
    start_sclk: int,
    end_sclk: int,
    db: Session = Depends(get_db)
):
    """Get mobility telemetry data for a given SCLK range."""
    service = TelemetryService(db)
    return service.get_mobility_telemetry(start_sclk, end_sclk)

@router.get("/motors", response_model=MotorTelemetryResponse)
async def get_segment_motor_telemetry(
    start_sclk: int,
    end_sclk: int,
    motors: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get motor telemetry data for a given SCLK range.
    
    Args:
        start_sclk: Start SCLK timestamp
        end_sclk: End SCLK timestamp  
        motors: Comma-separated list of motor names (optional)
    """
    motor_names = None
    if motors:
        motor_names = [motor.strip() for motor in motors.split(",")]
    
    service = TelemetryService(db)
    return service.get_motor_telemetry(start_sclk, end_sclk, motor_names)

@router.get("/motors/list", response_model=MotorListResponse)
async def list_available_motors(db: Session = Depends(get_db)):
    """Get list of available motor names."""
    service = TelemetryService(db)
    return service.get_available_motors()

@router.get("/nearest", response_model=NearestSCLKResponse)
async def get_nearest_sclk(easting: float, northing: float, db: Session = Depends(get_db)):
    """Find the nearest telemetry point to given coordinates (within 10m)."""
    service = TelemetryService(db)
    return service.get_nearest_sclk(easting, northing)

# Segment validation endpoint (must come before generic {sol}/{parameter} routes)
@router.get("/segments/validate", response_model=SegmentValidationResponse)
async def validate_segment(start_sclk: int, end_sclk: int, db: Session = Depends(get_db)):
    """Validate a drive segment and return metadata."""
    service = TelemetryService(db)
    return service.validate_segment(start_sclk, end_sclk)

@router.get("/{sol}/{parameter}", response_model=ChartDataResponse)
async def get_telemetry_data(sol: int, parameter: str, db: Session = Depends(get_db)):
    """
    Get telemetry data for a specific parameter from a sol.
    
    Args:
        sol: Sol number
        parameter: Parameter name (e.g., 'elevation', 'slope', 'terrain', 'DRIVE_LF.ODOM')
    """
    service = TelemetryService(db)
    return service.get_telemetry_data(sol, parameter)

@router.get("/{sol}/{parameter}/range")
async def get_telemetry_range(sol: int, parameter: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Get just the min/max range for a parameter in a sol.
    This is an optimized endpoint that only returns aggregate statistics.
    
    Args:
        sol: Sol number
        parameter: Parameter name (e.g., 'elevation', 'slope', 'DRIVE_LF.ODOM')
    """
    service = TelemetryService(db)
    return service.get_telemetry_range(sol, parameter)
