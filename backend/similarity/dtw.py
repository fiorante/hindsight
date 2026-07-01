"""
Dynamic Time Warping (DTW) similarity strategy.
"""

import logging
import pandas as pd
import numpy as np
from typing import List
from dtaidistance import dtw
from .base import SimilarityStrategy

logger = logging.getLogger(__name__)

class DTWStrategy(SimilarityStrategy):
    """
    Dynamic Time Warping similarity strategy.
    
    DTW is particularly good for comparing time-series of different lengths
    by finding the optimal alignment between two series.
    """
    
    def get_name(self) -> str:
        return "dtw"
    
    def calculate(self, reference_df: pd.DataFrame, comparison_df: pd.DataFrame, 
                 variables: List[str]) -> float:
        """
        Calculate DTW-based similarity between two drives.
        
        Args:
            reference_df: Reference drive telemetry data
            comparison_df: Comparison drive telemetry data
            variables: Variables to compare
            
        Returns:
            float: Similarity score (0-1, higher is more similar)
        """
        try:
            # Preprocess data
            ref_processed = self.preprocess_data(reference_df, variables)
            comp_processed = self.preprocess_data(comparison_df, variables)
            
            if ref_processed.empty or comp_processed.empty:
                return 0.0
            
            # Normalize data for fair comparison
            ref_normalized = self.normalize_data(ref_processed, variables)
            comp_normalized = self.normalize_data(comp_processed, variables)
            
            # Calculate DTW distance for each variable and combine
            total_distance = 0.0
            valid_comparisons = 0
            
            for variable in variables:
                if variable in ref_normalized.columns and variable in comp_normalized.columns:
                    ref_series = ref_normalized[variable].dropna().values
                    comp_series = comp_normalized[variable].dropna().values
                    
                    if len(ref_series) > 0 and len(comp_series) > 0:
                        try:
                            # Calculate DTW distance
                            distance = dtw.distance(ref_series, comp_series)
                            
                            # Handle infinite or very large distances
                            if np.isfinite(distance):
                                total_distance += distance
                                valid_comparisons += 1
                        except Exception as e:
                            logger.warning("DTW failed for variable %s: %s", variable, e)
                            continue

            if valid_comparisons == 0:
                return 0.0

            # Average distance across variables
            avg_distance = total_distance / valid_comparisons

            # Convert distance to similarity score (0-1, higher is more similar)
            # Use exponential decay to map distance to similarity
            similarity = np.exp(-avg_distance)

            return float(similarity)

        except Exception as e:
            logger.error("Error in DTW calculation: %s", e)
            return 0.0
    
