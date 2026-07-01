"""
Business logic for map and path-related operations.
"""

import json
from typing import Dict, Any, Optional
from pathlib import Path
from fastapi import HTTPException, status

from config import config


class MapService:
    """Service for map-related business logic."""
    
    def get_map_bounds(self) -> Dict[str, Any]:
        """Get map bounds and configuration for the frontend."""
        max_native = config.map_config["zoom"]["max_native"]
        return {
            "minZoom": config.map_config["zoom"]["min"],
            "maxNativeZoom": max_native,
            "maxZoom": max_native + 1,
            "tileSize": 256,
            "attribution": "Mars Orbital Map - NASA/JPL",
            "bounds": {
                "minLat": config.map_config["bounds"]["south"],
                "maxLat": config.map_config["bounds"]["north"],
                "minLng": config.map_config["bounds"]["west"], 
                "maxLng": config.map_config["bounds"]["east"]
            },
            "center": {
                "lat": (config.map_config["bounds"]["north"] + config.map_config["bounds"]["south"]) / 2,
                "lng": (config.map_config["bounds"]["east"] + config.map_config["bounds"]["west"]) / 2
            }
        }
    
    def get_rover_path(
        self,
        detail: str = "medium",
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lng: Optional[float] = None,
        max_lng: Optional[float] = None
    ) -> Dict[str, Any]:
        """Get rover path data for map visualization with optional viewport filtering."""
        
        # Validate detail level
        valid_details = ["low", "medium", "high", "full"]
        if detail not in valid_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid detail level. Must be one of: {valid_details}"
            )
        
        # Load the appropriate path data file
        rover_path_dir = config.data_dirs["rover_path"]
        path_file = rover_path_dir / f"rover_path_{detail}.json"
        
        if not path_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rover path data not found for detail level: {detail}"
            )
        
        try:
            with open(path_file, 'r') as f:
                path_data = json.load(f)
            
            points = path_data["points"]
            
            # Apply bounding box filtering if bounds are provided
            if all(param is not None for param in [min_lat, max_lat, min_lng, max_lng]):
                filtered_points = []
                for point in points:
                    lat, lng = point["latitude"], point["longitude"]
                    if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
                        filtered_points.append(point)
                
                points = filtered_points
                filtered_description = f"{path_data['description']} (filtered to viewport: {len(points)}/{path_data['total_points']} points)"
            else:
                filtered_description = path_data["description"]
            
            return {
                "detail_level": detail,
                "total_points": len(points),
                "original_total_points": path_data["total_points"],
                "decimation_factor": path_data["decimation_factor"],
                "description": filtered_description,
                "points": points,
                "bounds_applied": all(param is not None for param in [min_lat, max_lat, min_lng, max_lng])
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to load rover path data: {str(e)}"
            )
    
    def get_rover_path_sols(self) -> Dict[str, Any]:
        """Get sol boundary information for clickable path segments."""
        rover_path_dir = config.data_dirs["rover_path"]
        sols_file = rover_path_dir / "rover_path_sols.json"
        
        if not sols_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Rover path sol data not found"
            )
        
        try:
            with open(sols_file, 'r') as f:
                sols_data = json.load(f)
            
            return {
                "total_sols": sols_data["total_sols"],
                "description": sols_data["description"],
                "sols": sols_data["sols"]
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to load rover path sols data: {str(e)}"
            )
