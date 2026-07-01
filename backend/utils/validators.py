"""
Validation utilities for the API.
"""

from typing import Union, List


def validate_sol_range(sol: int) -> bool:
    """Validate that a sol number is a positive integer."""
    return sol > 0


def validate_sclk_range(start_sclk: int, end_sclk: int) -> bool:
    """Validate SCLK range parameters."""
    return start_sclk < end_sclk and start_sclk >= 0 and end_sclk >= 0


def validate_coordinates(easting: float, northing: float) -> bool:
    """Validate coordinate values are reasonable."""
    # Basic sanity check for Mars coordinates
    # These ranges are based on the Mars orbital map bounds
    return (-1000000 <= easting <= 1000000 and 
            -1000000 <= northing <= 1000000)


def sanitize_filename(filename: str) -> bool:
    """Check if filename is safe (no directory traversal)."""
    return ".." not in filename and "/" not in filename and "\\" not in filename
