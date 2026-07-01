"""
Repository for telemetry-related database operations.
"""

import logging
import pandas as pd
from typing import Optional, List

from .base import BaseRepository
from models import MobilityTelemetryPoint, MotorTelemetryPoint

logger = logging.getLogger(__name__)


class TelemetryRepository(BaseRepository):
    """Repository for telemetry data access."""
    
    def get_drive_telemetry(self, start_sclk: int, end_sclk: int) -> pd.DataFrame:
        """Get drive telemetry data for a specific SCLK range."""
        query = """
        SELECT sclk, easting, northing, elevation, slope, heading, velocity, terrain
        FROM drive_telemetry 
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk 
        ORDER BY sclk
        """
        return self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
    
    def get_mobility_telemetry(self, start_sclk: int, end_sclk: int) -> List[MobilityTelemetryPoint]:
        """Retrieve mobility telemetry data for a given SCLK range."""
        query = """
        SELECT * FROM mobility_telemetry 
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk
        ORDER BY sclk
        """
        
        try:
            df = self.execute_query(query, {"start_sclk": start_sclk, "end_sclk": end_sclk})
            # Replace NaN values with None for JSON serialization
            df = df.where(pd.notnull(df), None)
            return [MobilityTelemetryPoint(**row) for row in df.to_dict('records')]
        except Exception as e:
            logger.error("Error retrieving mobility telemetry: %s", e)
            return []
    
    def get_motor_telemetry(self, start_sclk: int, end_sclk: int, motor_names: Optional[List[str]] = None) -> dict:
        """Retrieve motor telemetry data for a given SCLK range, optionally filtered by motor names."""
        query = """
        SELECT * FROM motor_telemetry 
        WHERE sclk >= :start_sclk AND sclk <= :end_sclk
        """
        params = {"start_sclk": start_sclk, "end_sclk": end_sclk}
        
        if motor_names:
            # Create placeholder for motor names
            motor_placeholders = ",".join([f":motor_{i}" for i in range(len(motor_names))])
            query += f" AND motor_name IN ({motor_placeholders})"
            # Add motor names to params
            for i, motor_name in enumerate(motor_names):
                params[f"motor_{i}"] = motor_name
        
        query += " ORDER BY sclk, motor_name"
        
        try:
            df = self.execute_query(query, params)
            # Replace NaN values with None for JSON serialization
            df = df.where(pd.notnull(df), None)
            
            # Group by motor name
            motors_data = {}
            for motor_name in df['motor_name'].unique() if not df.empty else []:
                motor_df = df[df['motor_name'] == motor_name]
                motors_data[motor_name] = [MotorTelemetryPoint(**row) for row in motor_df.to_dict('records')]
            
            return motors_data
        except Exception as e:
            logger.error("Error retrieving motor telemetry: %s", e)
            return {}
    
    def get_available_motors(self) -> List[str]:
        """Get list of available motor names."""
        query = "SELECT DISTINCT motor_name FROM motor_telemetry ORDER BY motor_name"
        
        try:
            df = self.execute_query(query)
            return df['motor_name'].tolist() if not df.empty else []
        except Exception as e:
            logger.error("Error retrieving motor list: %s", e)
            return []
