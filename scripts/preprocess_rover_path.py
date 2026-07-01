#!/usr/bin/env python3
"""
Rover Path Preprocessing Script

This script processes the raw rover telemetry data from best_interp.csv to create
optimized path datasets for different zoom levels in the web interface.

The script extracts only the essential coordinates (longitude, latitude) along with
SCLK timestamps and Sol numbers, then creates decimated versions for efficient
rendering at different map zoom levels.

Output files:
- rover_path_full.json: Complete path data (every point)
- rover_path_zoom_X.json: Decimated data for zoom levels (every Nth point)
- rover_path_sols.json: Sol boundary information for clickable segments

Usage:
    python scripts/preprocess_rover_path.py [--decimation-factor N]
"""

import json
import csv
import argparse
from pathlib import Path
from typing import List, Dict, Any
import math

def load_rover_data(csv_path: Path) -> List[Dict[str, Any]]:
    """Load rover path data from CSV, filtering out invalid points."""
    rover_points = []
    
    print(f"Loading rover data from {csv_path}...")
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader):
            # Skip rows without valid coordinates or sol data
            try:
                longitude = float(row['longitude'])
                latitude = float(row['planetocentric_latitude'])  # Use planetocentric for actual rover movement
                sclk = int(row['sclk']) if row['sclk'] and row['sclk'] != '0' else None
                sol = int(row['sol']) if row['sol'] and row['sol'] != '-1' else None
                
                # Skip invalid coordinates or missing critical data
                if math.isnan(longitude) or math.isnan(latitude) or sol is None:
                    continue
                    
                rover_points.append({
                    'longitude': longitude,
                    'latitude': latitude,
                    'sclk': sclk,
                    'sol': sol,
                    'index': i  # Keep original index for reference
                })
                
            except (ValueError, TypeError):
                # Skip malformed rows
                continue
    
    print(f"Loaded {len(rover_points)} valid rover path points")
    return rover_points

def create_decimated_path(points: List[Dict[str, Any]], factor: int) -> List[Dict[str, Any]]:
    """Create a decimated version of the path by taking every Nth point."""
    if factor <= 1:
        return points
    
    decimated = []
    for i in range(0, len(points), factor):
        decimated.append(points[i])
    
    # Always include the last point to complete the path
    if len(points) > 0 and points[-1] not in decimated:
        decimated.append(points[-1])
    
    return decimated

def extract_sol_boundaries(points: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Extract sol start/end boundaries for clickable segments."""
    sol_boundaries = {}
    current_sol = None
    sol_start_idx = 0
    
    for i, point in enumerate(points):
        if point['sol'] != current_sol:
            # Finish previous sol if it exists
            if current_sol is not None:
                sol_boundaries[current_sol] = {
                    'sol': current_sol,
                    'start_index': sol_start_idx,
                    'end_index': i - 1,
                    'start_point': points[sol_start_idx],
                    'end_point': points[i - 1],
                    'point_count': i - sol_start_idx
                }
            
            # Start new sol
            current_sol = point['sol']
            sol_start_idx = i
    
    # Handle the last sol
    if current_sol is not None:
        sol_boundaries[current_sol] = {
            'sol': current_sol,
            'start_index': sol_start_idx,
            'end_index': len(points) - 1,
            'start_point': points[sol_start_idx],
            'end_point': points[-1],
            'point_count': len(points) - sol_start_idx
        }
    
    return sol_boundaries

def save_json(data: Any, output_path: Path) -> None:
    """Save data as formatted JSON."""
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved {output_path}")

def main():
    parser = argparse.ArgumentParser(description='Preprocess rover path data for web interface')
    parser.add_argument('--decimation-factor', type=int, default=10, 
                       help='Decimation factor for zoomed-out views (default: 10)')
    parser.add_argument('--input', type=str, default='data/pds/best_interp.csv',
                       help='Input CSV file path')
    parser.add_argument('--output-dir', type=str, default='backend/data/rover_path',
                       help='Output directory for processed files')

    args = parser.parse_args()

    # Setup paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_path = project_root / args.input
    output_dir = project_root / args.output_dir
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load raw data
    rover_points = load_rover_data(input_path)
    
    if not rover_points:
        print("Error: No valid rover points found!")
        return
    
    print(f"\nProcessing rover path data...")
    print(f"Total points: {len(rover_points)}")
    print(f"Sol range: {min(p['sol'] for p in rover_points)} to {max(p['sol'] for p in rover_points)}")
    
    # Create full resolution path
    full_path = {
        'points': rover_points,
        'total_points': len(rover_points),
        'decimation_factor': 1,
        'description': 'Full resolution rover path data'
    }
    save_json(full_path, output_dir / 'rover_path_full.json')
    
    # Create decimated paths for different zoom levels
    zoom_configs = [
        {'level': 'low', 'factor': args.decimation_factor * 5, 'description': f'Very low detail (every {args.decimation_factor * 5}th point)'},
        {'level': 'medium', 'factor': args.decimation_factor, 'description': f'Medium detail (every {args.decimation_factor}th point)'},
        {'level': 'high', 'factor': max(1, args.decimation_factor // 3), 'description': f'High detail (every {max(1, args.decimation_factor // 3)}th point)'},
    ]
    
    for config in zoom_configs:
        decimated_points = create_decimated_path(rover_points, config['factor'])
        decimated_path = {
            'points': decimated_points,
            'total_points': len(decimated_points),
            'decimation_factor': config['factor'],
            'description': config['description']
        }
        save_json(decimated_path, output_dir / f'rover_path_{config["level"]}.json')
        print(f"  {config['level']} detail: {len(decimated_points)} points")
    
    # Extract sol boundaries
    sol_boundaries = extract_sol_boundaries(rover_points)
    sol_data = {
        'sols': sol_boundaries,
        'total_sols': len(sol_boundaries),
        'description': 'Sol boundary information for clickable segments'
    }
    save_json(sol_data, output_dir / 'rover_path_sols.json')
    print(f"Sol boundaries: {len(sol_boundaries)} sols")
    
    print(f"\nProcessing complete! Output files saved to {output_dir}")
    print(f"\nUsage in backend: Serve these JSON files via API endpoints")
    print(f"Recommended zoom level mapping:")
    print(f"  Zoom 0-2: low detail ({zoom_configs[0]['factor']}x decimation)")
    print(f"  Zoom 3-5: medium detail ({zoom_configs[1]['factor']}x decimation)")
    print(f"  Zoom 6+: high detail ({zoom_configs[2]['factor']}x decimation)")

if __name__ == '__main__':
    main()