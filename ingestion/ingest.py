#!/usr/bin/env python3

import argparse
import json
import math
import os
import sys
import shutil
from pathlib import Path
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from PIL import Image
import re

# Updated constants for terrain types (matching labelmap.txt)
TERRAIN_TYPES = ["BEDROCK", "CRATER", "ROCK_FIELD", "SAND", "SAND_DUNE", "SOIL"]

# Terrain color mapping from labelmap.txt
TERRAIN_COLOR_MAP = {
    (51, 221, 255): "BEDROCK",
    (80, 254, 149): "CRATER", 
    (163, 187, 92): "ROCK_FIELD",
    (89, 134, 179): "SAND",
    (250, 50, 83): "SAND_DUNE",
    (250, 169, 226): "SOIL",
    (0, 0, 0): None  # background/unlabeled
}

# Terrain map bounds (Easting, Northing coordinates)
MAP_CROP_EASTING_1, MAP_CROP_NORTHING_1 = 4348230.971, 1095918.361
MAP_CROP_EASTING_2, MAP_CROP_NORTHING_2 = 4347453.442, 1096341.735

def load_config():
    """Load configuration from .env file."""
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).parent.parent))
    from shared.config import load_env_file, get_database_url, get_data_paths
    
    # Load environment variables from ingestion/.env
    load_env_file(Path(__file__).parent / '.env')
    
    # Check if running in Docker container
    if os.path.exists('/app/data'):
        # Docker container - use /app as base (data is mounted at /app/data)
        repo_root = Path('/app')
        data_paths = {
            'repo_root': repo_root,
            'data_interp_path': 'data/pds/best_interp.csv',
            'data_observations_path': 'data/pds/best_tactical.csv',
            'data_evr_path': 'data/unlimited_release_m20_data/EVRs',
            'data_mobility_path': 'data/unlimited_release_m20_data/telemetry_sys_mob_1040_1055/SOLS_1040_1055_SYS_MOB.csv',
            'data_motor_path': 'data/unlimited_release_m20_data/telemetry_drive_steer_1040_1055',
        }
    else:
        # Local development - use shared config
        data_paths = get_data_paths()
    
    return {
        'database_url': get_database_url(),
        'repo_root': data_paths['repo_root'],
        'data_interp_path': data_paths['data_interp_path'],
        'data_observations_path': data_paths['data_observations_path'],
        'data_evr_path': data_paths['data_evr_path'],
        'data_mobility_path': data_paths.get('data_mobility_path', ''),
        'data_motor_path': data_paths.get('data_motor_path', ''),
        'min_sol': int(os.getenv('MIN_SOL', 1040)),
        'max_sol': int(os.getenv('MAX_SOL', 1055))
    }

def get_db_engine(database_url):
    """Create and return SQLAlchemy database engine."""
    try:
        engine = create_engine(database_url)
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"✅ Successfully connected to database")
        return engine
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)

def calculate_tilt(pitch, roll):
    """Calculate rover tilt in degrees from pitch and roll in radians."""
    try:
        pitch = float(pitch)
        roll = float(roll)
        # Tilt = arccos(cos(pitch) * cos(roll))
        tilt = math.degrees(math.acos(math.cos(pitch) * math.cos(roll)))
        return tilt
    except (ValueError, TypeError):
        return None

def load_terrain_image(repo_root):
    """Load the terrain labels image."""
    terrain_image_path = repo_root / "data" / "terrain_maps" / "terrain_labels_sol1040_1055.png"
    if not terrain_image_path.exists():
        print(f"⚠️  Terrain image not found: {terrain_image_path}")
        return None
    
    try:
        image = Image.open(terrain_image_path)
        print(f"✅ Loaded terrain image: {image.size[0]}x{image.size[1]} pixels")
        return image
    except Exception as e:
        print(f"❌ Error loading terrain image: {e}")
        return None

def get_terrain_from_coordinates(easting, northing, terrain_image):
    """Get terrain type from easting/northing coordinates using the terrain image."""
    if terrain_image is None:
        return None
    
    try:
        # Check if coordinates are within bounds
        if not (min(MAP_CROP_EASTING_1, MAP_CROP_EASTING_2) <= easting <= max(MAP_CROP_EASTING_1, MAP_CROP_EASTING_2) and
                min(MAP_CROP_NORTHING_1, MAP_CROP_NORTHING_2) <= northing <= max(MAP_CROP_NORTHING_1, MAP_CROP_NORTHING_2)):
            return None
        
        # Convert easting/northing to pixel coordinates
        # Easting increases to the right (x-axis)
        # Northing increases to the top (y-axis, but image coordinates are inverted)
        width, height = terrain_image.size
        
        # Linear interpolation for x (easting)
        x_pixel = int((easting - MAP_CROP_EASTING_2) / (MAP_CROP_EASTING_1 - MAP_CROP_EASTING_2) * width)
        
        # Linear interpolation for y (northing) - note the inversion for image coordinates
        y_pixel = int((MAP_CROP_NORTHING_1 - northing) / (MAP_CROP_NORTHING_1 - MAP_CROP_NORTHING_2) * height)
        
        # Ensure pixel coordinates are within image bounds
        x_pixel = max(0, min(width - 1, x_pixel))
        y_pixel = max(0, min(height - 1, y_pixel))
        
        # Get pixel color
        pixel_color = terrain_image.getpixel((x_pixel, y_pixel))
        
        # Handle both RGB and RGBA images
        if len(pixel_color) >= 3:
            rgb_color = pixel_color[:3]
        else:
            return None
        
        # Look up terrain type
        return TERRAIN_COLOR_MAP.get(rgb_color, None)
        
    except Exception as e:
        print(f"❌ Error getting terrain for coordinates ({easting}, {northing}): {e}")
        return None



def read_drive_data(interp_path, observations_path, repo_root):
    """Read interpolated drive data and observations."""
    interp_file = repo_root / interp_path
    obs_file = repo_root / observations_path
    
    if not interp_file.exists():
        raise FileNotFoundError(f"Interpolated data file not found: {interp_file}")
    if not obs_file.exists():
        raise FileNotFoundError(f"Observations file not found: {obs_file}")
    
    print(f"📖 Reading interpolated data from: {interp_file}")
    interp_df = pd.read_csv(interp_file)
    
    print(f"📖 Reading observations data from: {obs_file}")
    obs_df = pd.read_csv(obs_file)
    
    # Clean column names
    interp_df.columns = interp_df.columns.str.strip()
    obs_df.columns = obs_df.columns.str.strip()
    
    print(f"✅ Loaded {len(interp_df)} interpolated records")
    print(f"✅ Loaded {len(obs_df)} observation records")
    
    return interp_df, obs_df

def read_evr_data(evr_path, sol, repo_root):
    """Read EVR data for a specific sol."""
    evr_file = repo_root / evr_path / f"{sol}_evrs.csv"
    
    if not evr_file.exists():
        print(f"⚠️  No EVR file found for sol {sol}: {evr_file}")
        return None
    
    try:
        evr_df = pd.read_csv(evr_file)
        evr_df.columns = evr_df.columns.str.strip()
        print(f"✅ Loaded {len(evr_df)} EVR records for sol {sol}")
        return evr_df
    except Exception as e:
        print(f"❌ Error reading EVR file for sol {sol}: {e}")
        return None

def transform_telemetry_data(interp_df, sol_range, terrain_image):
    """Transform interpolated data into telemetry format."""
    # Filter to specified sol range
    sol_data = interp_df[
        (interp_df['sol'] >= sol_range[0]) & 
        (interp_df['sol'] <= sol_range[1])
    ].copy()
    
    if sol_data.empty:
        print(f"⚠️  No data found for sol range {sol_range}")
        return pd.DataFrame()
    
    print(f"🔄 Processing {len(sol_data)} telemetry records for sols {sol_range[0]}-{sol_range[1]}")
    
    # Calculate tilt from pitch and roll
    sol_data['tilt'] = sol_data.apply(
        lambda row: calculate_tilt(row['pitch'], row['roll']), axis=1
    )
    
    # Get terrain data from coordinates
    print("🗺️  Looking up terrain data from coordinates...")
    sol_data['terrain'] = sol_data.apply(
        lambda row: get_terrain_from_coordinates(
            row['easting'], row['northing'], terrain_image
        ), axis=1
    )
    
    # Report terrain lookup results
    terrain_found = sol_data['terrain'].notna().sum()
    terrain_total = len(sol_data)
    print(f"✅ Terrain lookup complete: {terrain_found}/{terrain_total} points have terrain data")
    
    telemetry_df = sol_data.copy()
    # Normalize SCLK to int64
    try:
        telemetry_df['sclk'] = pd.to_numeric(telemetry_df['sclk'], errors='coerce')
        telemetry_df = telemetry_df.dropna(subset=['sclk'])
        telemetry_df['sclk'] = telemetry_df['sclk'].astype('int64')
    except Exception as e:
        print(f"⚠️  Failed to normalize telemetry SCLK to int64: {e}")
    
    # Select required columns for new schema
    columns = ['sclk', 'easting', 'northing', 'elevation', 'slope', 'heading', 'velocity', 'terrain']
    available_columns = [col for col in columns if col in telemetry_df.columns]
    telemetry_df = telemetry_df[available_columns]
    
    print(f"✅ Transformed telemetry data: {len(telemetry_df)} records")
    return telemetry_df

def extract_slip_values_from_evr_df(evr_df):
    """Extract slip values from EVR messages.

    Looks for messages starting with "VO slip FAST slip=0.000/" and returns a DataFrame
    containing columns ['sclk', 'slip'] with float slip values at those SCLKs.
    """
    if evr_df is None or evr_df.empty:
        return pd.DataFrame(columns=['sclk', 'slip'])

    # Ensure necessary columns exist
    if 'message' not in evr_df.columns or 'sclk' not in evr_df.columns:
        return pd.DataFrame(columns=['sclk', 'slip'])

    # Normalize message to string
    evr_df = evr_df.copy()
    evr_df['message'] = evr_df['message'].astype(str)

    # Filter messages that start with the pattern
    mask = evr_df['message'].str.startswith('VO slip FAST slip=')
    slip_rows = evr_df[mask]
    if slip_rows.empty:
        return pd.DataFrame(columns=['sclk', 'slip'])

    def parse_slip_from_message(msg: str):
        try:
            # Expect format: "VO slip FAST slip=0.000/...."
            prefix, rest = msg.split('slip=', 1)
            value_part = rest.split('/', 1)[0]
            return float(value_part)
        except Exception:
            return None

    slip_values = slip_rows['message'].apply(parse_slip_from_message)
    slip_df = pd.DataFrame({
        'sclk': pd.to_numeric(slip_rows['sclk'], errors='coerce'),
        'slip': slip_values
    }).dropna(subset=['sclk', 'slip'])

    # Convert to int64
    slip_df['sclk'] = slip_df['sclk'].astype('int64')
    slip_df['slip'] = slip_df['slip'].astype(float)
    # Deduplicate on sclk keeping the last occurrence
    slip_df = slip_df.drop_duplicates(subset=['sclk'], keep='last')
    return slip_df

def extract_faults_from_evr_df(evr_df, sol):
    """Extract mobility faults from EVR messages.
    
    Looks for EVRs with name == "MOM_EVR_FAULT" and extracts fault information
    from the message using the specified logic.
    """
    if evr_df is None or evr_df.empty:
        return pd.DataFrame(columns=['sol', 'sclk', 'fault_type'])
    
    # Ensure necessary columns exist
    if 'name' not in evr_df.columns or 'message' not in evr_df.columns or 'sclk' not in evr_df.columns:
        return pd.DataFrame(columns=['sol', 'sclk', 'fault_type'])
    
    # Filter for MOM_EVR_FAULT records
    fault_mask = evr_df['name'] == 'MOM_EVR_FAULT'
    fault_rows = evr_df[fault_mask]
    
    if fault_rows.empty:
        return pd.DataFrame(columns=['sol', 'sclk', 'fault_type'])
    
    def extract_fault_type_from_message(msg: str):
        """Extract fault type from MOM_EVR_FAULT message using the specified logic."""
        try:
            # Look for the pattern: "Mobility fault ... (first fault ..., drive fault ..., nav fault ...)"
            if 'Mobility fault' not in msg or '(' not in msg or ')' not in msg:
                return None
            
            # Extract the part in parentheses
            start_paren = msg.find('(')
            end_paren = msg.rfind(')')
            if start_paren == -1 or end_paren == -1:
                return None
            
            paren_content = msg[start_paren + 1:end_paren]
            
            # Parse first fault, drive fault, nav fault
            first_fault = None
            drive_fault = None
            nav_fault = None
            
            # Look for "first fault X"
            first_fault_match = re.search(r'first fault (\w+)', paren_content)
            if first_fault_match:
                first_fault = first_fault_match.group(1)
            
            # Look for "drive fault X"
            drive_fault_match = re.search(r'drive fault (\w+)', paren_content)
            if drive_fault_match:
                drive_fault = drive_fault_match.group(1)
            
            # Look for "nav fault X"
            nav_fault_match = re.search(r'nav fault (\w+)', paren_content)
            if nav_fault_match:
                nav_fault = nav_fault_match.group(1)
            
            # Apply the fault type extraction logic
            if first_fault in ['CUTOFF_TIME', 'SAPP_MARGIN']:
                return first_fault
            elif drive_fault and drive_fault != 'NONE':
                return drive_fault
            elif nav_fault and nav_fault != 'NONE':
                return nav_fault
            else:
                return first_fault
                
        except Exception:
            return None
    
    # Extract fault types
    fault_types = fault_rows['message'].apply(extract_fault_type_from_message)
    
    # Create faults DataFrame
    faults_df = pd.DataFrame({
        'sol': sol,
        'sclk': pd.to_numeric(fault_rows['sclk'], errors='coerce'),
        'fault_type': fault_types
    }).dropna(subset=['sclk', 'fault_type'])
    
    # Convert to proper types
    faults_df['sol'] = faults_df['sol'].astype(int)
    faults_df['sclk'] = faults_df['sclk'].astype('int64')
    faults_df['fault_type'] = faults_df['fault_type'].astype(str)
    
    # Remove duplicates (same sol, sclk, fault_type combination)
    faults_df = faults_df.drop_duplicates(subset=['sol', 'sclk', 'fault_type'])
    
    return faults_df

def transform_sols_data(telemetry_df, interp_df):
    """Create sols metadata from telemetry data."""
    if telemetry_df.empty:
        return pd.DataFrame()
    
    # Group telemetry data by sol (from original interpolated data)
    sols_data = []
    
    # Get sol information from original interpolated data
    sol_groups = interp_df.groupby('sol')
    
    for sol, sol_df in sol_groups:
        # Filter to telemetry records for this sol
        sol_telemetry = telemetry_df[telemetry_df['sclk'].isin(sol_df['sclk'])]
        
        if len(sol_telemetry) == 0:
            continue
            
        # Calculate distance between consecutive points
        if len(sol_telemetry) > 1:
            # Sort by SCLK to ensure correct order
            sol_telemetry_sorted = sol_telemetry.sort_values('sclk')
            distances = []
            for i in range(1, len(sol_telemetry_sorted)):
                prev_point = sol_telemetry_sorted.iloc[i-1]
                curr_point = sol_telemetry_sorted.iloc[i]
                
                # Calculate Euclidean distance
                dist = np.sqrt(
                    (curr_point['easting'] - prev_point['easting'])**2 + 
                    (curr_point['northing'] - prev_point['northing'])**2
                )
                distances.append(dist)
            total_distance = sum(distances)
        else:
            total_distance = 0.0
        
        # Calculate duration (SCLK difference)
        start_sclk = int(sol_telemetry['sclk'].min())
        end_sclk = int(sol_telemetry['sclk'].max())
        duration = float(end_sclk - start_sclk)  # Duration in SCLK units (roughly seconds)
        
        sol_record = {
            'sol': int(sol),
            'start_sclk': start_sclk,
            'end_sclk': end_sclk,
            'distance': float(total_distance),
            'duration': duration,
            'point_count': len(sol_telemetry)
        }
        sols_data.append(sol_record)
    
    sols_df = pd.DataFrame(sols_data)
    print(f"✅ Created sols metadata: {len(sols_df)} sols")
    return sols_df

def transform_evr_data(evr_df, sol):
    """Transform EVR data for database insertion."""
    if evr_df is None or evr_df.empty:
        return pd.DataFrame()
    
    # Work with a copy
    evr_df = evr_df.copy()
    
    # Ensure basic columns exist before filtering
    required_for_filtering = ['name', 'message', 'sclk']
    missing_filter_cols = [c for c in required_for_filtering if c not in evr_df.columns]
    if missing_filter_cols:
        print(f"⚠️  EVR data for sol {sol} missing required columns for filtering: {missing_filter_cols}. Skipping.")
        return pd.DataFrame()

    # Normalize types for filtering
    evr_df['message'] = evr_df['message'].astype(str)
    # Sort chronologically to make range selection deterministic
    try:
        evr_df = evr_df.sort_values('sclk').reset_index(drop=True)
    except Exception:
        pass

    # Use the full EVR file for the sol without restricting to drive windows
    work_df = evr_df.copy()

    # The first column (Unnamed: 0) is the log_num - rename it if present
    if work_df.columns[0] == 'Unnamed: 0':
        work_df = work_df.rename(columns={'Unnamed: 0': 'log_num'})
    
    # Select required columns and rename if needed (no drive_sol in new schema)
    evr_columns = ['log_num', 'sclk', 'module', 'message', 'name', 'eventId', 'level']
    available_columns = [col for col in evr_columns if col in work_df.columns]
    
    if len(available_columns) < 5:  # At minimum need log_num, sclk, message, name, eventId
        print(f"⚠️  Missing required EVR columns for sol {sol}")
        return pd.DataFrame()
    
    evr_df = work_df[available_columns].copy()
    
    # Rename fields to match database schema
    if 'eventId' in evr_df.columns:
        evr_df = evr_df.rename(columns={'eventId': 'event_id'})
    # Normalize canonical LEVEL values as-is from source if present
    if 'LEVEL' in work_df.columns and 'level' not in evr_df.columns:
        evr_df['level'] = work_df['LEVEL']
    
    # Fill missing columns with defaults
    if 'module' not in evr_df.columns:
        evr_df['module'] = 'UNKNOWN'
    if 'name' not in evr_df.columns:
        evr_df['name'] = 'UNKNOWN_EVR'
    
    # Ensure required dtypes and sanitize
    # sclk must be int64
    evr_df['sclk'] = pd.to_numeric(evr_df['sclk'], errors='coerce')
    # log_num should be integer-like if available
    if 'log_num' in evr_df.columns:
        evr_df['log_num'] = pd.to_numeric(evr_df['log_num'], errors='coerce')
    # event_id may be missing
    if 'event_id' in evr_df.columns:
        evr_df['event_id'] = pd.to_numeric(evr_df['event_id'], errors='coerce')
    # Drop rows without valid sclk
    evr_df = evr_df.dropna(subset=['sclk'])
    # Cast integer columns
    evr_df['sclk'] = evr_df['sclk'].astype('int64')
    if 'log_num' in evr_df.columns:
        # Some CSVs may have float log_num; cast to int64 after coercion
        evr_df['log_num'] = evr_df['log_num'].astype('int64')
    # Normalize text columns
    if 'module' in evr_df.columns:
        evr_df['module'] = evr_df['module'].astype(str)
    if 'message' in evr_df.columns:
        evr_df['message'] = evr_df['message'].astype(str)
    if 'name' in evr_df.columns:
        evr_df['name'] = evr_df['name'].astype(str)
    if 'level' in evr_df.columns:
        evr_df['level'] = evr_df['level'].astype(str)

    # Ensure columns are in the correct order for database insertion
    final_columns = ['log_num', 'sclk', 'module', 'message', 'name', 'event_id', 'level']
    evr_df = evr_df[final_columns]
    
    print(f"✅ Transformed {len(evr_df)} EVR records for sol {sol}")
    return evr_df

def read_mobility_data(data_path, repo_root):
    """Read mobility system telemetry data from SYS_MOB CSV file."""
    if not data_path:
        print("⚠️  No mobility data path configured, skipping mobility telemetry")
        return None
    
    mobility_file = repo_root / data_path
    
    if not mobility_file.exists():
        print(f"⚠️  Mobility data file not found: {mobility_file}")
        return None
    
    print(f"📖 Reading mobility data from {mobility_file}")
    
    try:
        mobility_df = pd.read_csv(mobility_file)
        print(f"📋 Mobility data shape: {mobility_df.shape}")
        return mobility_df
    except Exception as e:
        print(f"❌ Error reading mobility data: {e}")
        return None

def transform_mobility_data(mobility_df, sol_range):
    """Transform mobility system telemetry data for database loading."""
    if mobility_df is None or mobility_df.empty:
        return pd.DataFrame()
    
    print(f"🔄 Transforming mobility data...")
    
    # Normalize column names to lowercase for consistent processing
    try:
        mobility_df.columns = mobility_df.columns.str.strip().str.lower()
    except Exception:
        pass
    
    # Filter by sol range if sol column exists
    if 'sol' in mobility_df.columns:
        mobility_df = mobility_df[
            (mobility_df['sol'] >= sol_range[0]) & 
            (mobility_df['sol'] <= sol_range[1])
        ]
    
    # Define the columns we want to extract
    mobility_columns = [
        'sclk', 'bogie_l', 'bogie_r', 'diff_l', 'diff_r', 'accel_x', 
        'pos_y', 'pos_x', 'accel_y', 'accel_z', 'pitch', 'pos_z', 
        'accel_pitch', 'roll', 'yaw', 'tilt', 'accel_tilt', 'accel_roll', 
        'elapsed_time', 'pos_x_x', 'raw_accel_z', 'raw_accel_x', 'raw_accel_y'
    ]
    
    # Select only columns that exist in the DataFrame
    available_columns = [col for col in mobility_columns if col in mobility_df.columns]
    
    if 'sclk' not in available_columns:
        print("❌ No sclk column found in mobility data")
        return pd.DataFrame()
    
    mobility_df = mobility_df[available_columns].copy()
    
    # Normalize and convert sclk to integer
    mobility_df['sclk'] = pd.to_numeric(mobility_df['sclk'], errors='coerce')
    mobility_df = mobility_df.dropna(subset=['sclk'])
    mobility_df['sclk'] = mobility_df['sclk'].astype('int64')

    # Convert angular values from radians to degrees when present
    angle_columns_in_radians = [
        'bogie_l', 'bogie_r', 'diff_l', 'diff_r',
        'accel_pitch', 'accel_roll', 'accel_tilt',
        'accel_x', 'accel_y', 'accel_z',
        'raw_accel_x', 'raw_accel_y', 'raw_accel_z',
        'yaw', 'pitch', 'roll', 'tilt'
    ]
    for column_name in angle_columns_in_radians:
        if column_name in mobility_df.columns:
            mobility_df[column_name] = np.degrees(pd.to_numeric(mobility_df[column_name], errors='coerce'))
    
    # Remove duplicates based on sclk
    mobility_df = mobility_df.drop_duplicates(subset=['sclk'])
    
    print(f"✅ Transformed {len(mobility_df)} mobility records")
    return mobility_df

def read_motor_data(data_path, repo_root):
    """Read motor telemetry data from drive/steer motor CSV files."""
    if not data_path:
        print("⚠️  No motor data path configured, skipping motor telemetry")
        return []
    
    motor_dir = repo_root / data_path
    
    if not motor_dir.exists():
        print(f"⚠️  Motor data directory not found: {motor_dir}")
        return []
    
    print(f"📖 Reading motor data from {motor_dir}")
    
    # Define motor file patterns
    motor_patterns = [
        'SOLS_*_DRIVE_LF.csv', 'SOLS_*_DRIVE_LM.csv', 'SOLS_*_DRIVE_LR.csv',
        'SOLS_*_DRIVE_RF.csv', 'SOLS_*_DRIVE_RM.csv', 'SOLS_*_DRIVE_RR.csv',
        'SOLS_*_STEER_LF.csv', 'SOLS_*_STEER_LR.csv', 
        'SOLS_*_STEER_RF.csv', 'SOLS_*_STEER_RR.csv'
    ]
    
    motor_data = []
    
    # Find all motor CSV files
    for pattern in motor_patterns:
        files = list(motor_dir.glob(pattern))
        for file in files:
            # Extract motor name from filename (e.g., DRIVE_LF, STEER_RF)
            motor_name = file.stem.split('_')[-2] + '_' + file.stem.split('_')[-1]
            
            try:
                print(f"   Reading {motor_name} from {file}")
                motor_df = pd.read_csv(file)
                motor_df['motor_name'] = motor_name
                motor_data.append(motor_df)
                print(f"   📋 {motor_name} data shape: {motor_df.shape}")
            except Exception as e:
                print(f"   ❌ Error reading {motor_name}: {e}")
    
    print(f"✅ Read data for {len(motor_data)} motors")
    return motor_data

def transform_motor_data(motor_dfs, sol_range):
    """Transform motor telemetry data for database loading."""
    if not motor_dfs:
        return pd.DataFrame()
    
    print(f"🔄 Transforming motor data...")
    
    all_motor_data = []
    
    for motor_df in motor_dfs:
        if motor_df.empty:
            continue
        
        motor_name = motor_df['motor_name'].iloc[0]

        # Normalize column names to lowercase to match DB schema
        try:
            motor_df.columns = motor_df.columns.str.strip().str.lower()
        except Exception:
            pass

        # Ensure motor_name column exists and is lowercase
        if 'motor_name' not in motor_df.columns:
            motor_df['motor_name'] = motor_name
        
        # Filter by sol range if sol column exists
        if 'sol' in motor_df.columns:
            motor_df = motor_df[
                (motor_df['sol'] >= sol_range[0]) & 
                (motor_df['sol'] <= sol_range[1])
            ]
        
        # Define the columns we want to extract
        motor_columns = [
            'sclk', 'motor_name', 'odom', 'angle', 'voltage', 'field', 'state', 
            'cbrake_ma', 'cmotor', 'cstatus', 'cbrake_status', 'tprt1', 'angular_rate'
        ]
        
        # Select only columns that exist in the DataFrame
        available_columns = [col for col in motor_columns if col in motor_df.columns]
        
        if 'sclk' not in available_columns:
            print(f"❌ No sclk column found in {motor_name} data")
            continue
        
        motor_df = motor_df[available_columns].copy()
        
        # Normalize and convert sclk to integer
        motor_df['sclk'] = pd.to_numeric(motor_df['sclk'], errors='coerce')
        motor_df = motor_df.dropna(subset=['sclk'])
        motor_df['sclk'] = motor_df['sclk'].astype('int64')
        
        # Remove duplicates based on sclk, motor_name
        motor_df = motor_df.drop_duplicates(subset=['sclk', 'motor_name'])
        
        all_motor_data.append(motor_df)
        print(f"   ✅ Transformed {len(motor_df)} {motor_name} records")
    
    if all_motor_data:
        combined_motor_df = pd.concat(all_motor_data, ignore_index=True)
        print(f"✅ Combined {len(combined_motor_df)} total motor records")
        return combined_motor_df
    
    return pd.DataFrame()

def process_pdi_images(repo_root, sols_with_drive_data):
    """Process Post Drive Imagery (PDI) for sols that have drive data."""
    print("📷 Processing Post Drive Imagery (PDI)...")
    
    if not sols_with_drive_data:
        print("⚠️  No sols with drive data found")
        return pd.DataFrame()
    
    print(f"📋 Processing PDI for {len(sols_with_drive_data)} sols with drive data: {sorted(sols_with_drive_data)}")
    
    # Define PDI image directories
    pdi_dirs = {
        'fhaz': repo_root / "data" / "unlimited_release_m20_data" / "datavis_fhaz_1040_1055",
        'rhaz': repo_root / "data" / "unlimited_release_m20_data" / "datavis_rhaz_1040_1055", 
        'ncam': repo_root / "data" / "unlimited_release_m20_data" / "datavis_ncam_1040_1055"
    }
    
    # Check if directories exist
    for camera_type, pdi_dir in pdi_dirs.items():
        if not pdi_dir.exists():
            print(f"⚠️  PDI directory not found: {pdi_dir}")
            return pd.DataFrame()
    
    # Create PDI output directory
    if os.path.exists('/app/writable'):
        # Docker container - use writable volume
        pdi_output_dir = Path('/app/writable/pdi')
    elif os.path.exists('/app/data'):
        # Docker container - use /app/data
        pdi_output_dir = Path('/app/data/pdi')
    else:
        # Local development - use backend/data
        pdi_output_dir = repo_root / "backend" / "data" / "pdi"
    
    # Try to create directory, but handle permission errors gracefully
    try:
        pdi_output_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        # If directory already exists, try to use it
        if pdi_output_dir.exists():
            print(f"⚠️  PDI directory already exists: {pdi_output_dir}")
        else:
            raise
    
    pdi_records = []
    
    for sol in sorted(sols_with_drive_data):
        print(f"   🔍 Processing PDI for sol {sol}")
        
        sol_record = {'sol': sol}
        
        # Process each camera type
        for camera_type, pdi_dir in pdi_dirs.items():
            camera_images = {'left': None, 'right': None}
            
            # Find all images for this sol and camera type
            pattern = f"{camera_type[0].upper()}*F_{sol}_*"  # e.g., "F*F_1041_*", "R*F_1041_*", "N*F_1041_*"
            matching_files = list(pdi_dir.glob(pattern))
            
            if not matching_files:
                print(f"     ⚠️  No {camera_type} images found for sol {sol}")
                continue
            
            # Group by left/right and find highest SCLK for each
            left_images = []
            right_images = []
            
            for file_path in matching_files:
                filename = file_path.name
                # Parse filename: e.g., "FLF_1041_0759360157_901FDR_..."
                parts = filename.split('_')
                if len(parts) < 4:
                    continue
                
                # First character determines camera, second character determines side
                camera_char = parts[0][0]  # F, R, or N
                side_char = parts[0][1]    # L or R
                sol_num = int(parts[1])
                sclk = int(parts[2])
                
                # Verify this is the correct camera type and sol
                expected_camera = camera_type[0].upper()
                if camera_char != expected_camera or sol_num != sol:
                    continue
                
                if side_char == 'L':
                    left_images.append((sclk, filename, file_path))
                elif side_char == 'R':
                    right_images.append((sclk, filename, file_path))
            
            # Get highest SCLK for each side
            if left_images:
                left_images.sort(key=lambda x: x[0], reverse=True)
                camera_images['left'] = left_images[0]
            
            if right_images:
                right_images.sort(key=lambda x: x[0], reverse=True)
                camera_images['right'] = right_images[0]
            
            # Handle SCLK mismatch: if SCLKs don't match, use higher one and drop the lower
            left_sclk = camera_images['left'][0] if camera_images['left'] else None
            right_sclk = camera_images['right'][0] if camera_images['right'] else None
            
            if left_sclk and right_sclk and left_sclk != right_sclk:
                if left_sclk > right_sclk:
                    print(f"     ⚠️  SCLK mismatch for {camera_type} sol {sol}: keeping left ({left_sclk}) dropping right ({right_sclk})")
                    camera_images['right'] = None
                else:
                    print(f"     ⚠️  SCLK mismatch for {camera_type} sol {sol}: keeping right ({right_sclk}) dropping left ({left_sclk})")
                    camera_images['left'] = None
            
            # Copy selected images and record metadata
            for side in ['left', 'right']:
                if camera_images[side]:
                    sclk, filename, file_path = camera_images[side]
                    
                    # Copy image to PDI directory
                    dest_path = pdi_output_dir / filename
                    
                    if not dest_path.exists():
                        try:
                            shutil.copy2(file_path, dest_path)
                        except PermissionError:
                            print(f"     ⚠️  Permission denied copying {camera_type} {side}: {filename}")
                            continue
                    
                    # Record metadata
                    sol_record[f'{camera_type}_{side}_filename'] = filename
                    sol_record[f'{camera_type}_{side}_sclk'] = sclk
        
        # Only add record if at least one image was found
        if any(key.endswith('_filename') for key in sol_record.keys()):
            pdi_records.append(sol_record)
    
    if pdi_records:
        pdi_df = pd.DataFrame(pdi_records)
        print(f"✅ Processed PDI for {len(pdi_df)} sols")
        return pdi_df
    else:
        print("⚠️  No PDI images found for any sols")
        return pd.DataFrame()

def process_vce_images(repo_root, sols_with_drive_data):
    """Process Visual Compute Element (VCE) images for sols that have drive data."""
    print("📷 Processing Visual Compute Element (VCE) images...")
    
    if not sols_with_drive_data:
        print("⚠️  No sols with drive data found")
        return pd.DataFrame()
    
    print(f"📋 Processing VCE for {len(sols_with_drive_data)} sols with drive data: {sorted(sols_with_drive_data)}")
    
    # Define VCE image directory
    vce_dir = repo_root / "data" / "unlimited_release_m20_data" / "datavis_vce_1040_1055"
    
    # Check if directory exists
    if not vce_dir.exists():
        print(f"⚠️  VCE directory not found: {vce_dir}")
        return pd.DataFrame()
    
    # Create VCE output directory
    if os.path.exists('/app/writable'):
        # Docker container - use writable volume
        vce_output_dir = Path('/app/writable/vce')
    elif os.path.exists('/app/data'):
        # Docker container - use /app/data
        vce_output_dir = Path('/app/data/vce')
    else:
        # Local development - use backend/data
        vce_output_dir = repo_root / "backend" / "data" / "vce"
    
    # Try to create directory, but handle permission errors gracefully
    try:
        vce_output_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        # If directory already exists, try to use it
        if vce_output_dir.exists():
            print(f"⚠️  VCE directory already exists: {vce_output_dir}")
        else:
            raise
    
    vce_records = []
    
    for sol in sorted(sols_with_drive_data):
        print(f"   🔍 Processing VCE for sol {sol}")
        
        # Find sol directory (format: 01041, 01042, etc.)
        sol_dir = vce_dir / f"{sol:05d}"
        
        if not sol_dir.exists():
            print(f"     ⚠️  Sol directory not found: {sol_dir}")
            continue
        
        # Find all VCE images for this sol
        # Pattern: VgncRaw[Left|Right]_[sclk]-...
        vce_files = list(sol_dir.glob("VgncRaw*.png"))
        
        if not vce_files:
            print(f"     ⚠️  No VCE images found for sol {sol}")
            continue
        
        # Group images by SCLK timestamp
        sclk_groups = {}
        
        for file_path in vce_files:
            filename = file_path.name
            # Parse filename: VgncRawLeft_0759350534-24319-1_rectified.png
            try:
                if filename.startswith('VgncRawLeft_'):
                    side = 'left'
                    sclk_part = filename[len('VgncRawLeft_'):].split('-')[0]
                elif filename.startswith('VgncRawRight_'):
                    side = 'right'
                    sclk_part = filename[len('VgncRawRight_'):].split('-')[0]
                else:
                    print(f"     ⚠️  Unrecognized VCE filename format: {filename}")
                    continue
                
                sclk = int(sclk_part)
                
                if sclk not in sclk_groups:
                    sclk_groups[sclk] = {'left': None, 'right': None}
                
                sclk_groups[sclk][side] = (filename, file_path)
                
            except (ValueError, IndexError) as e:
                print(f"     ⚠️  Error parsing VCE filename {filename}: {e}")
                continue
        
        # Process each SCLK group
        sol_pair_count = 0
        for sclk, images in sclk_groups.items():
            # Only create records if we have at least one image
            if images['left'] or images['right']:
                record = {
                    'sol': sol,
                    'sclk': sclk,
                    'left_filename': None,
                    'right_filename': None
                }

                # Copy images and record filenames
                for side in ['left', 'right']:
                    if images[side]:
                        filename, file_path = images[side]

                        # Destination path for VCE image
                        dest_path = vce_output_dir / filename

                        # Always record filename even if we skip copying
                        record[f'{side}_filename'] = filename

                        if not dest_path.exists():
                            try:
                                shutil.copy2(file_path, dest_path)
                            except PermissionError:
                                print(f"     ⚠️  Permission denied copying {side} VCE image: {filename}")
                                continue

                vce_records.append(record)
                sol_pair_count += 1
        print(f"   ✅ Sol {sol}: {sol_pair_count} VCE stereo pairs")

    if vce_records:
        vce_df = pd.DataFrame(vce_records)
        print(f"✅ Processed VCE for {len(set(r['sol'] for r in vce_records))} sols, {len(vce_records)} stereo pairs total")
        return vce_df
    else:
        print("⚠️  No VCE images found for any sols")
        return pd.DataFrame()

def clear_database(engine):
    """Clear all data from the database tables."""
    print("🗑️  Clearing existing data...")
    
    with engine.connect() as conn:
        try:
            # Clear tables in order (respecting foreign key constraints)
            conn.execute(text("DELETE FROM slip_telemetry"))
            conn.execute(text("DELETE FROM vce_images"))
            conn.execute(text("DELETE FROM pdi_images"))
            conn.execute(text("DELETE FROM evrs"))
            conn.execute(text("DELETE FROM motor_telemetry"))
            conn.execute(text("DELETE FROM mobility_telemetry"))
            conn.execute(text("DELETE FROM drive_telemetry"))
            conn.execute(text("DELETE FROM sols"))
            conn.commit()
            print("✅ Database cleared")
        except Exception as e:
            print(f"❌ Error clearing database: {e}")
            conn.rollback()
            raise

def load_data_to_db(sols_df, telemetry_df, evr_dfs, mobility_df, motor_df, pdi_df, vce_df, engine, clear_first=False, slip_df: pd.DataFrame = pd.DataFrame(), fault_dfs: list = None):
    """Load transformed data into the database."""
    print("📤 Loading data to database...")
    
    try:
        if clear_first:
            clear_database(engine)
        
        # Load telemetry data first (no dependencies)
        if not telemetry_df.empty:
            telemetry_df.to_sql('drive_telemetry', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(telemetry_df)} telemetry records")
        
        # Load mobility telemetry data
        if not mobility_df.empty:
            mobility_df.to_sql('mobility_telemetry', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(mobility_df)} mobility telemetry records")
        
        # Load motor telemetry data
        if not motor_df.empty:
            motor_df.to_sql('motor_telemetry', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(motor_df)} motor telemetry records")
        
        # Load sols metadata
        if not sols_df.empty:
            sols_df.to_sql('sols', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(sols_df)} sol records")

        # Load slip telemetry
        if not slip_df.empty:
            slip_df.to_sql('slip_telemetry', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(slip_df)} slip telemetry records")
        
        # Load faults data
        if fault_dfs:
            faults_to_load = pd.concat(fault_dfs, ignore_index=True).drop_duplicates(subset=['sol', 'sclk', 'fault_type'])
            faults_to_load.to_sql('faults', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(faults_to_load)} fault records")
        else:
            print("⚠️  No fault records found to load")
        
        # Load PDI data (depends on sols)
        if not pdi_df.empty:
            pdi_df.to_sql('pdi_images', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(pdi_df)} PDI records")
        
        # Load VCE data (depends on sols)
        if not vce_df.empty:
            vce_df.to_sql('vce_images', engine, if_exists='append', index=False)
            print(f"✅ Loaded {len(vce_df)} VCE records")
        
        # Load EVR data
        total_evr_records = 0
        for evr_df in evr_dfs:
            if not evr_df.empty:
                evr_df.to_sql('evrs', engine, if_exists='append', index=False)
                total_evr_records += len(evr_df)
        
        if total_evr_records > 0:
            print(f"✅ Loaded {total_evr_records} EVR records")
        
        print("🎉 Data loading completed successfully!")
        
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        raise

def main():
    """Main ingestion pipeline function."""
    parser = argparse.ArgumentParser(description="Hindsight Data Ingestion Pipeline")
    parser.add_argument("--clear", action="store_true", 
                       help="Clear database before ingesting new data")
    parser.add_argument("--sol-range", nargs=2, type=int, metavar=('START', 'END'),
                       help="Sol range to ingest (overrides config)")
    parser.add_argument("--config-check", action="store_true",
                       help="Check configuration and exit")
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config()
    
    if args.config_check:
        print("📋 Configuration:")
        for key, value in config.items():
            print(f"  {key}: {value}")
        return
    
    # Override sol range if provided
    if args.sol_range:
        config['min_sol'], config['max_sol'] = args.sol_range
    
    sol_range = (config['min_sol'], config['max_sol'])
    print(f"🚀 Starting ingestion for sols {sol_range[0]}-{sol_range[1]}")
    
    # Get repository root from config
    repo_root = Path(config.get('repo_root', Path(__file__).parent.parent.parent))
    print(f"📁 Repository root: {repo_root}")
    
    # Connect to database
    engine = get_db_engine(config['database_url'])
    
    try:
        # Load terrain image
        terrain_image = load_terrain_image(repo_root)
        
        # Read interpolated and observation data
        interp_df, obs_df = read_drive_data(
            config['data_interp_path'], 
            config['data_observations_path'],
            repo_root
        )
        
        # Transform telemetry data
        telemetry_df = transform_telemetry_data(interp_df, sol_range, terrain_image)
        
        # Create sols metadata
        sols_df = transform_sols_data(telemetry_df, interp_df)
        
        # Read and transform EVR data for each sol that has telemetry data
        evr_dfs = []
        slip_dfs = []
        fault_dfs = []
        sols_with_telemetry = interp_df[
            (interp_df['sol'] >= sol_range[0]) & 
            (interp_df['sol'] <= sol_range[1])
        ]['sol'].unique()
        print(f"📋 Processing EVR data for sols with telemetry: {sorted(sols_with_telemetry)}")
        
        for sol in sorted(sols_with_telemetry):
            evr_df = read_evr_data(config['data_evr_path'], sol, repo_root)
            if evr_df is not None:
                # Store EVRs for DB load (filtered to drive sequence)
                transformed_evr = transform_evr_data(evr_df, sol)
                if not transformed_evr.empty:
                    evr_dfs.append(transformed_evr)
                # Extract slip values from the FULL sol EVR file (not restricted to trav0 window)
                slip_df = extract_slip_values_from_evr_df(evr_df)
                if not slip_df.empty:
                    slip_dfs.append(slip_df)
                # Extract faults from the FULL sol EVR file (not restricted to trav0 window)
                faults_df = extract_faults_from_evr_df(evr_df, sol)
                if not faults_df.empty:
                    fault_dfs.append(faults_df)
                    print(f"✅ Found {len(faults_df)} faults for sol {sol}")
                else:
                    print(f"⚠️  No faults found for sol {sol}")

        # Prepare slip telemetry for separate table
        slip_to_load = pd.DataFrame()
        if slip_dfs:
            slip_to_load = pd.concat(slip_dfs, ignore_index=True).drop_duplicates(subset=['sclk'], keep='last')
            print(f"✅ Prepared {len(slip_to_load)} slip telemetry points")
        else:
            print("⚠️  No slip EVR values found to load")
        
        # Read mobility data
        mobility_df = read_mobility_data(config['data_mobility_path'], repo_root)
        if mobility_df is not None:
            transformed_mobility_df = transform_mobility_data(mobility_df, sol_range)
        else:
            transformed_mobility_df = pd.DataFrame()

        # Read motor data
        motor_dfs = read_motor_data(config['data_motor_path'], repo_root)
        if motor_dfs:
            transformed_motor_df = transform_motor_data(motor_dfs, sol_range)
        else:
            transformed_motor_df = pd.DataFrame()
        
        # Determine which sols have drive data (from the transformed sols_df)
        sols_with_drive_data = sols_df['sol'].tolist() if not sols_df.empty else []
        
        # Process PDI images only for sols that have drive data
        pdi_df = process_pdi_images(repo_root, sols_with_drive_data)
        
        # Process VCE images only for sols that have drive data
        vce_df = process_vce_images(repo_root, sols_with_drive_data)
        
        # Load data to database (include slip telemetry and faults)
        load_data_to_db(
            sols_df,
            telemetry_df,
            evr_dfs,
            transformed_mobility_df,
            transformed_motor_df,
            pdi_df,
            vce_df,
            engine,
            clear_first=args.clear,
            slip_df=slip_to_load,
            fault_dfs=fault_dfs,
        )
        
        # Print summary
        print("\n📊 Ingestion Summary:")
        print(f"  • Sols: {len(sols_df)}")
        print(f"  • Telemetry points: {len(telemetry_df)}")
        print(f"  • Mobility telemetry points: {len(transformed_mobility_df)}")
        print(f"  • Motor telemetry points: {len(transformed_motor_df)}")
        print(f"  • EVR records: {sum(len(df) for df in evr_dfs)}")
        print(f"  • PDI records: {len(pdi_df)}")
        print(f"  • Sol range: {sol_range[0]}-{sol_range[1]}")
        
    except Exception as e:
        print(f"❌ Ingestion failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 