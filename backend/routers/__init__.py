"""
FastAPI routers for the Hindsight API.
"""

from .health import router as health_router
from .sols import router as sols_router
from .telemetry import router as telemetry_router
from .search import router as search_router
from .images import router as images_router
from .maps import router as maps_router
from .evrs import router as evrs_router
from .faults import router as faults_router

__all__ = [
    "health_router",
    "sols_router", 
    "telemetry_router",
    "search_router",
    "images_router",
    "maps_router",
    "evrs_router",
    "faults_router"
]
