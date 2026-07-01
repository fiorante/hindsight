"""
Hindsight Backend API.

This FastAPI application provides the backend services for Hindsight,
including data retrieval, explicit queries, and similarity search functionality.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import config
from middleware import add_error_handlers
from routers import (
    health_router,
    sols_router,
    telemetry_router,
    search_router,
    images_router,
    maps_router,
    evrs_router,
    faults_router
)

# FastAPI app configuration
app = FastAPI(
    title="Hindsight API",
    description="Backend API for Mars rover drive analysis and similarity search",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add error handling
add_error_handlers(app)

# Include routers
app.include_router(health_router)
app.include_router(sols_router)
app.include_router(telemetry_router)
app.include_router(search_router)
app.include_router(images_router)
app.include_router(maps_router)
app.include_router(evrs_router)
app.include_router(faults_router)

if __name__ == "__main__":
    import uvicorn
    
    print(f"Starting Hindsight API server...")
    print(f"Documentation: http://{config.server_config['host']}:{config.server_config['port']}/docs")
    
    uvicorn.run(
        app, 
        host=config.server_config['host'], 
        port=config.server_config['port'], 
        reload=False
    )
