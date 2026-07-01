"""
Shared configuration utilities for Hindsight.
Provides consistent environment variable loading and database URL construction.
"""

import logging
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


def load_env_file(env_file_path: Optional[Path] = None) -> None:
    """
    Load environment variables from a .env file.
    
    Args:
        env_file_path: Path to the .env file. If None, looks for .env in current directory.
    """
    if env_file_path is None:
        env_file_path = Path.cwd() / '.env'
    
    if env_file_path.exists():
        load_dotenv(env_file_path)
    else:
        logger.warning(".env file not found at %s", env_file_path)


def get_database_url() -> str:
    """
    Construct DATABASE_URL from component environment variables.
    
    Returns:
        Constructed database URL string
        
    Raises:
        RuntimeError: If required database environment variables are missing
    """
    # DATABASE_URL takes precedence over individual DB_* variables
    if os.getenv('DATABASE_URL'):
        return os.getenv('DATABASE_URL')
    
    # Get component variables
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'drive_analysis')
    db_user = os.getenv('DB_USER', os.getenv('USER', 'postgres'))  # Use current user if not specified
    db_password = os.getenv('DB_PASSWORD', '')
    
    # Validate required fields
    if not db_name:
        raise RuntimeError("DB_NAME environment variable is required")
    # DB_USER can be empty - we'll use system username
    
    # Construct URL
    if db_password:
        return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        return f"postgresql://{db_user}@{db_host}:{db_port}/{db_name}"


def get_data_paths() -> dict:
    """
    Get data file paths from environment variables.
    
    Returns:
        Dictionary containing data paths
    """
    # Repository root is two levels up from this file (shared/config.py → shared/ → root)
    repo_root = Path(__file__).parent.parent
    
    return {
        'repo_root': repo_root,
        'data_interp_path': os.getenv('DATA_INTERP_PATH', 'data/pds/best_interp.csv'),
        'data_observations_path': os.getenv('DATA_OBSERVATIONS_PATH', 'data/pds/best_tactical.csv'),
        'data_evr_path': os.getenv('DATA_EVR_PATH', 'data/unlimited_release_m20_data/EVRs'),
        'data_mobility_path': os.getenv('DATA_MOBILITY_PATH', 'data/unlimited_release_m20_data/telemetry_sys_mob_1040_1050/SOLS_1040_1055_SYS_MOB.csv'),
        'data_motor_path': os.getenv('DATA_MOTOR_PATH', 'data/unlimited_release_m20_data/telemetry_drive_steer_1040_1055'),
        'min_sol': int(os.getenv('MIN_SOL', '1040')),
        'max_sol': int(os.getenv('MAX_SOL', '1055'))
    }


def get_server_config() -> dict:
    """
    Get server configuration from environment variables.
    
    Returns:
        Dictionary containing server configuration
    """
    return {
        'host': os.getenv('SERVER_HOST', '127.0.0.1'),
        'port': int(os.getenv('SERVER_PORT', '8000')),
        'debug': os.getenv('DEBUG', 'false').lower() == 'true'
    }


def validate_config() -> bool:
    """
    Validate that all required configuration is present.
    
    Returns:
        True if configuration is valid, False otherwise
    """
    try:
        # Test database URL construction
        get_database_url()
        
        # Test data paths
        data_paths = get_data_paths()
        repo_root = data_paths['repo_root']
        
        # Check if data files exist
        interp_path = repo_root / data_paths['data_interp_path']
        obs_path = repo_root / data_paths['data_observations_path']
        
        if not interp_path.exists():
            logger.warning("Interpolated data file not found: %s", interp_path)
        if not obs_path.exists():
            logger.warning("Observations data file not found: %s", obs_path)

        return True

    except Exception as e:
        logger.error("Configuration validation failed: %s", e)
        return False 