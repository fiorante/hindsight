"""
Feature-based k-NN similarity strategy.
"""

import logging
import pandas as pd
import numpy as np
from typing import List, Dict, Any
from sklearn.metrics.pairwise import euclidean_distances
from sklearn.preprocessing import StandardScaler
from .base import SimilarityStrategy

logger = logging.getLogger(__name__)

class KNNStrategy(SimilarityStrategy):
    """
    Feature-based k-Nearest Neighbors similarity strategy.
    
    This approach extracts statistical features from time-series data
    and then uses standard distance metrics in feature space.
    """
    
    def get_name(self) -> str:
        return "knn"
    
    def calculate(self, reference_df: pd.DataFrame, comparison_df: pd.DataFrame, 
                 variables: List[str]) -> float:
        """
        Calculate feature-based similarity between two drives.
        
        Args:
            reference_df: Reference drive telemetry data
            comparison_df: Comparison drive telemetry data
            variables: Variables to compare
            
        Returns:
            float: Similarity score (0-1, higher is more similar)
        """
        try:
            # Extract features for both drives
            ref_features = self.extract_features(reference_df, variables)
            comp_features = self.extract_features(comparison_df, variables)
            
            if not ref_features or not comp_features:
                return 0.0
            
            # Convert to feature vectors
            ref_vector = self.features_to_vector(ref_features, variables)
            comp_vector = self.features_to_vector(comp_features, variables)
            
            if len(ref_vector) == 0 or len(comp_vector) == 0:
                return 0.0
            
            # Calculate Euclidean distance in feature space
            ref_vector = np.array(ref_vector).reshape(1, -1)
            comp_vector = np.array(comp_vector).reshape(1, -1)
            
            # Standardize features to give equal weight
            scaler = StandardScaler()
            combined_vectors = np.vstack([ref_vector, comp_vector])
            scaled_vectors = scaler.fit_transform(combined_vectors)
            
            ref_scaled = scaled_vectors[0].reshape(1, -1)
            comp_scaled = scaled_vectors[1].reshape(1, -1)
            
            # Calculate distance
            distance = euclidean_distances(ref_scaled, comp_scaled)[0, 0]
            
            # Convert distance to similarity score
            # Use exponential decay to map distance to similarity
            similarity = np.exp(-distance)
            
            return float(similarity)
            
        except Exception as e:
            logger.error("Error in k-NN calculation: %s", e)
            return 0.0
    
    def extract_features(self, df: pd.DataFrame, variables: List[str]) -> Dict[str, Dict[str, float]]:
        """
        Extract statistical features from time-series data.
        
        Args:
            df: Input telemetry dataframe
            variables: Variables to extract features from
            
        Returns:
            Dict mapping variable names to their features
        """
        features = {}
        
        for variable in variables:
            if variable not in df.columns:
                continue
                
            series = df[variable].dropna()
            if len(series) == 0:
                continue
            
            var_features = {}
            
            # Basic statistical features
            var_features['mean'] = float(series.mean())
            var_features['std'] = float(series.std()) if len(series) > 1 else 0.0
            var_features['min'] = float(series.min())
            var_features['max'] = float(series.max())
            var_features['median'] = float(series.median())
            
            # Distribution features
            var_features['q25'] = float(series.quantile(0.25))
            var_features['q75'] = float(series.quantile(0.75))
            var_features['range'] = var_features['max'] - var_features['min']
            var_features['iqr'] = var_features['q75'] - var_features['q25']
            
            # Shape features
            if len(series) > 2:
                var_features['skew'] = float(series.skew())
                var_features['kurt'] = float(series.kurtosis())
            else:
                var_features['skew'] = 0.0
                var_features['kurt'] = 0.0
            
            # Trend features
            if len(series) > 1:
                # Simple linear trend (slope of best-fit line)
                x = np.arange(len(series))
                slope = np.polyfit(x, series.values, 1)[0]
                var_features['trend'] = float(slope)
                
                # Variation features
                diff_series = series.diff().dropna()
                if len(diff_series) > 0:
                    var_features['diff_mean'] = float(diff_series.mean())
                    var_features['diff_std'] = float(diff_series.std()) if len(diff_series) > 1 else 0.0
                else:
                    var_features['diff_mean'] = 0.0
                    var_features['diff_std'] = 0.0
            else:
                var_features['trend'] = 0.0
                var_features['diff_mean'] = 0.0
                var_features['diff_std'] = 0.0
            
            # Peak features
            var_features['num_peaks'] = self.count_peaks(series)
            
            features[variable] = var_features
        
        return features
    
    def count_peaks(self, series: pd.Series, prominence_threshold: float = 0.1) -> int:
        """
        Count the number of peaks in a time series.
        
        Args:
            series: Input time series
            prominence_threshold: Minimum prominence for peak detection
            
        Returns:
            Number of peaks found
        """
        try:
            from scipy.signal import find_peaks
            
            values = series.values
            if len(values) < 3:
                return 0
            
            # Normalize for prominence calculation
            value_range = values.max() - values.min()
            if value_range == 0:
                return 0
            
            min_prominence = prominence_threshold * value_range
            peaks, _ = find_peaks(values, prominence=min_prominence)
            
            return len(peaks)
            
        except ImportError:
            # Fall back to simple peak counting if scipy not available
            return self.simple_peak_count(series)
        except Exception:
            return 0
    
    def simple_peak_count(self, series: pd.Series) -> int:
        """
        Simple peak counting without scipy.
        
        Args:
            series: Input time series
            
        Returns:
            Number of peaks found
        """
        if len(series) < 3:
            return 0
        
        values = series.values
        peaks = 0
        
        for i in range(1, len(values) - 1):
            if values[i] > values[i-1] and values[i] > values[i+1]:
                peaks += 1
        
        return peaks
    
    def features_to_vector(self, features: Dict[str, Dict[str, float]], 
                          variables: List[str]) -> List[float]:
        """
        Convert feature dictionary to a flat feature vector.
        
        Args:
            features: Features dictionary from extract_features
            variables: Variables to include
            
        Returns:
            Flat list of feature values
        """
        vector = []
        
        # Define feature order to ensure consistency
        feature_names = [
            'mean', 'std', 'min', 'max', 'median',
            'q25', 'q75', 'range', 'iqr',
            'skew', 'kurt', 'trend',
            'diff_mean', 'diff_std', 'num_peaks'
        ]
        
        for variable in variables:
            if variable in features:
                var_features = features[variable]
                for feature_name in feature_names:
                    value = var_features.get(feature_name, 0.0)
                    # Handle NaN values
                    if np.isnan(value) or np.isinf(value):
                        value = 0.0
                    vector.append(value)
            else:
                # Fill with zeros if variable not available
                vector.extend([0.0] * len(feature_names))
        
        return vector 