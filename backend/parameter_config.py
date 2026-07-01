"""
Centralized parameter configuration for telemetry data.

This module defines which parameters belong to which database tables,
their units, and other metadata to avoid duplication across endpoints.
"""

from typing import Any, Dict, Set, Optional, Tuple, Literal
from enum import Enum

class ParameterType(Enum):
    """Types of telemetry parameters."""
    DRIVE = "drive"
    MOBILITY = "mobility"
    MOTOR = "motor"
    SLIP = "slip"
    TERRAIN = "terrain"

class ParameterConfig:
    """Configuration for telemetry parameters."""
    
    # Parameter sets by table
    DRIVE_TELEMETRY_PARAMS: Set[str] = {
        'elevation', 'slope', 'heading', 'velocity', 'terrain', 'easting', 'northing'
    }
    
    MOBILITY_TELEMETRY_PARAMS: Set[str] = {
        'accel_x', 'accel_y', 'accel_z', 'raw_accel_x', 'raw_accel_y', 'raw_accel_z',
        'pitch', 'roll', 'yaw', 'tilt', 'accel_pitch', 'accel_roll', 'accel_tilt', 
        'bogie_l', 'bogie_r', 'diff_l', 'diff_r', 'pos_x', 'pos_y', 'pos_z', 
        'elapsed_time'
    }
    
    # Special parameters
    SLIP_PARAM = 'slip'
    TERRAIN_PARAM = 'terrain'

    @classmethod
    def get_parameter_type(cls, parameter: str) -> ParameterType:
        """
        Determine the type of a parameter based on its name.
        
        Args:
            parameter: Parameter name (e.g., 'elevation', 'DRIVE_LF.ODOM')
            
        Returns:
            ParameterType enum value
        """
        param_lower = parameter.lower()
        
        # Check for motor parameters (format: MOTOR.PARAM)
        if '.' in parameter:
            return ParameterType.MOTOR
        
        # Check for special parameters
        if param_lower == cls.SLIP_PARAM:
            return ParameterType.SLIP
        elif param_lower == cls.TERRAIN_PARAM:
            return ParameterType.TERRAIN
        
        # Check parameter sets
        if param_lower in cls.MOBILITY_TELEMETRY_PARAMS:
            return ParameterType.MOBILITY
        elif param_lower in cls.DRIVE_TELEMETRY_PARAMS:
            return ParameterType.DRIVE
        
        # Default to drive telemetry
        return ParameterType.DRIVE
    
    @classmethod
    def get_table_info(cls, parameter: str) -> Tuple[str, str, Dict[str, Any]]:
        """
        Get table information for a parameter.
        
        Args:
            parameter: Parameter name
            
        Returns:
            Tuple of (table_name, column_name, query_params)
        """
        param_type = cls.get_parameter_type(parameter)
        param_lower = parameter.lower()
        
        if param_type == ParameterType.MOTOR:
            motor_name, motor_param = parameter.split('.', 1)
            normalized_motor_name = (motor_name or '').lower()
            normalized_param = (motor_param or '').lower()
            
            return (
                'motor_telemetry',
                normalized_param,
                {
                    'motor_name': normalized_motor_name,
                    'column': normalized_param
                }
            )
        
        elif param_type == ParameterType.SLIP:
            return ('slip_telemetry', 'slip', {'column': 'slip'})
        
        elif param_type == ParameterType.MOBILITY:
            return ('mobility_telemetry', param_lower, {'column': param_lower})
        
        elif param_type == ParameterType.TERRAIN:
            return ('drive_telemetry', 'terrain', {'column': 'terrain'})
        
        else:  # ParameterType.DRIVE
            return ('drive_telemetry', param_lower, {'column': param_lower})

    @classmethod
    def is_numeric(cls, parameter: str) -> bool:
        """
        Check if a parameter has numeric values (can calculate min/max).
        
        Args:
            parameter: Parameter name
            
        Returns:
            True if parameter is numeric, False otherwise
        """
        param_type = cls.get_parameter_type(parameter)
        
        # Terrain is categorical, not numeric
        if param_type == ParameterType.TERRAIN:
            return False
        
        # All other parameters are numeric
        return True
    
    @classmethod
    def build_query(cls, parameter: str, query_type: Literal['data', 'range'],
                   start_sclk: int, end_sclk: int) -> Tuple[str, Dict[str, Any]]:
        """
        Build SQL query for a parameter.
        
        Args:
            parameter: Parameter name
            query_type: 'data' for full data or 'range' for min/max
            start_sclk: Start SCLK timestamp
            end_sclk: End SCLK timestamp
            
        Returns:
            Tuple of (sql_query, parameters_dict)
        """
        table_name, column_name, table_params = cls.get_table_info(parameter)
        param_type = cls.get_parameter_type(parameter)
        
        params = {
            "start_sclk": start_sclk,
            "end_sclk": end_sclk
        }
        
        if query_type == 'range':
            # Build range query (min/max)
            if param_type == ParameterType.MOTOR:
                sql = f"""
                    SELECT MIN({column_name}) as min_value, MAX({column_name}) as max_value
                    FROM {table_name}
                    WHERE sclk BETWEEN :start_sclk AND :end_sclk
                    AND LOWER(motor_name) = :motor_name
                    AND {column_name} IS NOT NULL
                """
                params['motor_name'] = table_params['motor_name']
            else:
                sql = f"""
                    SELECT MIN({column_name}) as min_value, MAX({column_name}) as max_value
                    FROM {table_name}
                    WHERE sclk BETWEEN :start_sclk AND :end_sclk
                    AND {column_name} IS NOT NULL
                """
        else:
            # Build data query (full time series)
            if param_type == ParameterType.MOTOR:
                sql = f"""
                    SELECT sclk, {column_name} AS value
                    FROM {table_name}
                    WHERE sclk BETWEEN :start_sclk AND :end_sclk
                    AND LOWER(motor_name) = :motor_name
                    AND {column_name} IS NOT NULL
                    ORDER BY sclk
                """
                params['motor_name'] = table_params['motor_name']
            else:
                sql = f"""
                    SELECT sclk, {column_name}
                    FROM {table_name}
                    WHERE sclk BETWEEN :start_sclk AND :end_sclk
                    AND {column_name} IS NOT NULL
                    ORDER BY sclk
                """
        
        return sql, params