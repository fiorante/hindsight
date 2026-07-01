"""
Map and tile serving endpoints.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from services.map_service import MapService
from config import config

router = APIRouter(prefix="/map", tags=["maps"])

@router.get("/tiles/{z}/{x}/{y}.png")
async def get_map_tile(z: int, x: int, y: int):
    """Serve map tiles in standard XYZ format for supported zoom levels."""
    
    # Validate zoom level against configured native range
    min_zoom = config.map_config["zoom"]["min"]
    max_native_zoom = config.map_config["zoom"]["max_native"]
    
    if z < min_zoom or z > max_native_zoom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Zoom level {z} not supported. Supported range: {min_zoom} to {max_native_zoom}"
        )
    
    # Construct tile path
    map_tiles_dir = config.data_dirs["map_tiles"]
    tile_path = map_tiles_dir / str(z) / str(x) / f"{y}.png"
    
    if not tile_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tile not found: z={z}, x={x}, y={y}"
        )
    
    return FileResponse(tile_path, media_type="image/png")

@router.get("/bounds")
async def get_map_bounds():
    """Get map bounds and configuration for the frontend."""
    service = MapService()
    return service.get_map_bounds()

@router.get("/rover-path")
async def get_rover_path(
    detail: str = "medium",
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lng: Optional[float] = None,
    max_lng: Optional[float] = None
):
    """
    Get rover path data for map visualization with optional viewport filtering.
    
    Args:
        detail: Path detail level - 'low', 'medium', 'high', or 'full'
                Recommended mapping:
                - Zoom 0-2: 'low' (50x decimation)
                - Zoom 3-5: 'medium' (10x decimation)  
                - Zoom 6+: 'high' (3x decimation)
                - Full resolution: 'full' (use sparingly)
        min_lat, max_lat, min_lng, max_lng: Optional bounding box for viewport filtering
                If provided, only points within the bounding box are returned
    """
    service = MapService()
    return service.get_rover_path(detail, min_lat, max_lat, min_lng, max_lng)

@router.get("/rover-path/sols")
async def get_rover_path_sols():
    """Get sol boundary information for clickable path segments."""
    service = MapService()
    return service.get_rover_path_sols()
