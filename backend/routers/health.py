"""
Health check endpoints.
"""

from datetime import datetime
from fastapi import APIRouter
from sqlalchemy import text

from models import HealthResponse
from database.connection import get_engine

router = APIRouter(prefix="", tags=["health"])

@router.get("/", response_model=dict)
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Hindsight API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "sols_list": "/sols/list",
            "sol_detail": "/sols/{sol}",
            "nearest_sclk": "/telemetry/nearest",
            "segment_validation": "/segments/validate",
            "mobility_telemetry": "/telemetry/mobility",
            "motor_telemetry": "/telemetry/motors",
            "motor_list": "/telemetry/motors/list",
            "similarity_search": "/query/similar",
            "explicit_query": "/query/explicit",
            "pdi_images": "/images/pdi/{filename}",
            "pdi_list": "/images/pdi/",
            "vce_images": "/images/vce/{filename}",
            "vce_data": "/vce/{sol}",
            "evrs_data": "/evrs/{sol}",
            "faults_data": "/faults/{sol}",
            "map_tiles": "/map/tiles/{z}/{x}/{y}.png",
            "map_bounds": "/map/bounds",
            "rover_path": "/map/rover-path",
            "rover_path_sols": "/map/rover-path/sols"
        }
    }

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        # Test database connection
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False
    
    status_val = "healthy" if db_connected else "unhealthy"
    
    return HealthResponse(
        status=status_val,
        database_connected=db_connected,
        timestamp=datetime.utcnow()
    )
