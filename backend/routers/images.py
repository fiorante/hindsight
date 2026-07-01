"""
Image serving endpoints for PDI and VCE images.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from models import SolPDI, SolVCE
from database.connection import get_db
from services.image_service import ImageService
from config import config

router = APIRouter(tags=["images"])

# PDI Endpoints

@router.get("/images/pdi/{filename}")
async def get_pdi_image(filename: str):
    """
    Serve PDI images from the backend data directory.
    
    Note: Images are served directly from the backend data directory.
    For production deployments, a dedicated image server or CDN is recommended.
    """
    # Validate filename to prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename"
        )
    
    pdi_images_dir = config.data_dirs["pdi_images"]
    
    # Ensure PDI directory exists
    if not pdi_images_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDI images directory not found: {pdi_images_dir}. Run data ingestion to populate PDI images."
        )
    
    # Construct image path
    image_path = pdi_images_dir / filename
    
    if not image_path.exists():
        # Check if any PDI images exist
        pdi_files = list(pdi_images_dir.glob("*.png")) + list(pdi_images_dir.glob("*.jpg"))
        if not pdi_files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDI image not found: {filename}. No PDI images available - run data ingestion to populate images."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDI image not found: {filename}"
            )
    
    # Determine media type based on file extension
    extension = image_path.suffix.lower()
    if extension == ".png":
        media_type = "image/png"
    elif extension in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(image_path, media_type=media_type)

@router.get("/images/pdi/")
async def list_pdi_images():
    """
    List available PDI images for debugging purposes.
    
    Note: This endpoint is for development/testing only.
    """
    pdi_images_dir = config.data_dirs["pdi_images"]
    
    if not pdi_images_dir.exists():
        return {
            "error": "PDI images directory not found",
            "directory": str(pdi_images_dir),
            "suggestion": "Run data ingestion to populate PDI images"
        }
    
    # Get all image files
    image_files = []
    for extension in ["*.png", "*.jpg", "*.jpeg"]:
        image_files.extend(pdi_images_dir.glob(extension))
    
    return {
        "pdi_directory": str(pdi_images_dir),
        "total_images": len(image_files),
        "images": sorted([img.name for img in image_files])
    }

@router.get("/pdi/{sol}", response_model=SolPDI)
async def get_pdi_for_sol(sol: int, db: Session = Depends(get_db)):
    """
    Get PDI (Post Drive Imagery) data for a specific sol.
    Returns camera sets (fhaz, rhaz, ncam) with left/right images and SCLKs.
    """
    service = ImageService(db)
    pdi_data = service.get_sol_pdi(sol)
    if pdi_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No PDI data found for sol {sol}"
        )
    return pdi_data

# VCE Endpoints

@router.get("/vce/{sol}", response_model=SolVCE)
async def get_vce_for_sol(sol: int, db: Session = Depends(get_db)):
    """
    Get VCE (Visual Compute Element) images for a specific sol.
    
    Returns stereo image pairs taken during the drive.
    """
    service = ImageService(db)
    vce_data = service.get_sol_vce(sol)
    
    if vce_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No VCE data found for sol {sol}"
        )
    
    return vce_data

@router.get("/images/vce/{filename}")
async def get_vce_image(filename: str):
    """
    Serve VCE images from the backend data directory.
    
    Note: Images are served directly from the backend data directory.
    For production deployments, a dedicated image server or CDN is recommended.
    """
    # Validate filename to prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename"
        )
    
    vce_images_dir = config.data_dirs["vce_images"]
    image_path = vce_images_dir / filename
    
    if not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"VCE image not found: {filename}"
        )
    
    # Determine media type from extension
    extension = image_path.suffix.lower()
    if extension == ".png":
        media_type = "image/png"
    elif extension in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(image_path, media_type=media_type)
