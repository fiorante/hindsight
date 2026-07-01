"""
Business logic for image-related operations (PDI and VCE).
"""

import logging
from typing import Optional
import pandas as pd
from sqlalchemy.orm import Session

from models import SolPDI, PDICameraSet, PDIImage, VCEImage, SolVCE
from database.repositories.base import BaseRepository
from config import config

logger = logging.getLogger(__name__)


class ImageService:
    """Service for image-related business logic."""
    
    def __init__(self, db: Session):
        self.db = db
        self.repo = BaseRepository(db)
    
    def get_sol_pdi(self, sol: int) -> Optional[SolPDI]:
        """Get PDI data for a specific sol."""
        query = """
        SELECT sol, fhaz_left_filename, fhaz_left_sclk, fhaz_right_filename, fhaz_right_sclk,
               rhaz_left_filename, rhaz_left_sclk, rhaz_right_filename, rhaz_right_sclk,
               ncam_left_filename, ncam_left_sclk, ncam_right_filename, ncam_right_sclk
        FROM pdi_images
        WHERE sol = :sol
        """
        
        try:
            df = self.repo.execute_query(query, {"sol": sol})
            
            if df.empty:
                return None
            
            row = df.iloc[0]
            
            # Helper function to create PDIImage
            def create_pdi_image(filename: Optional[str], sclk: Optional[int], description: str) -> Optional[PDIImage]:
                if pd.isna(filename) or filename is None:
                    return None
                return PDIImage(
                    filename=filename,
                    sclk=int(sclk) if pd.notna(sclk) else None,
                    description=description
                )
            
            # Create camera sets
            fhaz = PDICameraSet(
                left=create_pdi_image(row['fhaz_left_filename'], row['fhaz_left_sclk'], "Front Hazcam (L)"),
                right=create_pdi_image(row['fhaz_right_filename'], row['fhaz_right_sclk'], "Front Hazcam (R)"),
                camera_type="fhaz",
                description="Front Hazcam"
            )
            
            rhaz = PDICameraSet(
                left=create_pdi_image(row['rhaz_left_filename'], row['rhaz_left_sclk'], "Rear Hazcam (L)"),
                right=create_pdi_image(row['rhaz_right_filename'], row['rhaz_right_sclk'], "Rear Hazcam (R)"),
                camera_type="rhaz",
                description="Rear Hazcam"
            )
            
            ncam = PDICameraSet(
                left=create_pdi_image(row['ncam_left_filename'], row['ncam_left_sclk'], "Navcam (L)"),
                right=create_pdi_image(row['ncam_right_filename'], row['ncam_right_sclk'], "Navcam (R)"),
                camera_type="ncam",
                description="Navcam"
            )
            
            return SolPDI(
                sol=int(row['sol']),
                fhaz=fhaz,
                rhaz=rhaz,
                ncam=ncam
            )
            
        except Exception as e:
            logger.error("Error retrieving PDI data for sol %s: %s", sol, e)
            return None
    
    def get_sol_vce(self, sol: int) -> Optional[SolVCE]:
        """Get VCE data for a specific sol."""
        query = """
        SELECT sol, sclk, left_filename, right_filename
        FROM vce_images
        WHERE sol = :sol
        ORDER BY sclk ASC
        """
        
        try:
            df = self.repo.execute_query(query, {"sol": sol})
            
            if df.empty:
                return None
            
            vce_images = []
            for _, row in df.iterrows():
                vce_image = VCEImage(
                    sclk=int(row['sclk']),
                    left_filename=row['left_filename'] if pd.notna(row['left_filename']) else None,
                    right_filename=row['right_filename'] if pd.notna(row['right_filename']) else None
                )
                vce_images.append(vce_image)
            
            return SolVCE(
                sol=int(sol),
                images=vce_images
            )
            
        except Exception as e:
            logger.error("Error retrieving VCE data for sol %s: %s", sol, e)
            return None
