"""
Centralized error handling middleware.
"""

import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def add_error_handlers(app: FastAPI):
    """Add centralized error handlers to the FastAPI app."""
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with consistent response format."""
        logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {request.url}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP Error",
                "detail": exc.detail,
                "status_code": exc.status_code,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle Starlette HTTP exceptions."""
        logger.warning(f"Starlette HTTP {exc.status_code}: {exc.detail} - {request.url}")
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTP Error",
                "detail": exc.detail,
                "status_code": exc.status_code,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        )
    
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Handle 404 errors with consistent format."""
        logger.info(f"404 Not Found: {request.url}")
        
        return JSONResponse(
            status_code=404,
            content={
                "error": "Not Found",
                "detail": "The requested resource was not found",
                "status_code": 404,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        )
    
    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        """Handle 500 errors with consistent format."""
        logger.error(f"500 Internal Server Error: {request.url} - {str(exc)}")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred",
                "status_code": 500,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle any unhandled exceptions."""
        logger.error(f"Unhandled exception: {request.url} - {str(exc)}", exc_info=True)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": "An unexpected error occurred",
                "status_code": 500,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        )
