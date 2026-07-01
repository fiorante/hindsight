"""
Configuration management for the Hindsight API.
"""

import sys
from pathlib import Path
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from shared.config import load_env_file, get_database_url, get_server_config

class Config:
    """Application configuration."""
    
    def __init__(self):
        # .env lives at the repo root (one level above backend/)
        load_env_file(Path(__file__).parent.parent / '.env')
        
        # Database configuration
        self.database_url = get_database_url()
        
        # Server configuration
        self.server_config = get_server_config()
        
        # Map configuration
        self.map_config = self._get_map_config()
        
        # Directory paths
        self.data_dirs = self._get_data_directories()
    
    def _get_map_config(self) -> Dict[str, Any]:
        """Get map-related configuration."""
        return {
            "bounds": {
                "west": 77.25338372796834,
                "east": 77.47215676466411, 
                "north": 18.50823447169246,
                "south": 18.41865155989587
            },
            "zoom": {
                "min": -5,
                "max_native": -1
            }
        }
    
    def _get_data_directories(self) -> Dict[str, Path]:
        """Get data directory paths."""
        backend_dir = Path(__file__).parent
        data_dir = backend_dir / "data"
        
        return {
            "map_tiles": data_dir / "map_tiles",
            "rover_path": data_dir / "rover_path", 
            "pdi_images": data_dir / "pdi",
            "vce_images": data_dir / "vce"
        }
    
    @property
    def cors_origins(self) -> list[str]:
        """Get CORS allowed origins."""
        return ["http://localhost:3000", "http://localhost:5173"]

# Global configuration instance
config = Config()
