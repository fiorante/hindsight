"""
Abstract base class for similarity search strategies.
"""

import logging
from abc import ABC, abstractmethod
import pandas as pd
from typing import List, Optional

logger = logging.getLogger(__name__)

class SimilarityStrategy(ABC):
    """
    Abstract base class that all similarity algorithms must inherit from.
    
    This follows the Strategy design pattern to allow for interchangeable
    similarity algorithms.
    """
    
    @abstractmethod
    def calculate(self, reference_df: pd.DataFrame, comparison_df: pd.DataFrame, 
                 variables: List[str]) -> float:
        """
        Calculate a similarity score between two dataframes.
        
        Args:
            reference_df: The reference drive's telemetry data
            comparison_df: The comparison drive's telemetry data  
            variables: List of column names to use for comparison
            
        Returns:
            float: Similarity score (higher means more similar)
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Get the name of this similarity strategy.
        
        Returns:
            str: Strategy name
        """
        pass
    
    def calculate_fault_similarity(self, reference_faults: List[str], comparison_faults: List[str]) -> float:
        """
        Calculate fault-based similarity between two drives.

        Priority order (descending):
        1. Drives whose sequences of faults are the same
        2. Drives who share the same last fault
        3. Drives who share the same set of faults (regardless of order)
        4. Drives who share some subset of faults

        Args:
            reference_faults: Ordered list of fault types for the reference drive
            comparison_faults: Ordered list of fault types for the comparison drive

        Returns:
            float: Fault similarity score (0-1, higher is more similar)
        """
        try:
            # Handle case where both drives have no faults
            if not reference_faults and not comparison_faults:
                return 1.0

            # Handle case where one drive has faults and the other doesn't
            if not reference_faults or not comparison_faults:
                return 0.0

            # Both drives have faults - apply priority-based similarity

            # Priority 1: Identical fault sequences
            if reference_faults == comparison_faults:
                return 1.0

            # Priority 2: Same last fault
            if reference_faults[-1] == comparison_faults[-1]:
                return 0.8

            # Priority 3: Same set of faults regardless of order
            reference_fault_set = set(reference_faults)
            comparison_fault_set = set(comparison_faults)

            if reference_fault_set == comparison_fault_set:
                return 0.6

            # Priority 4: One set is a subset of the other
            if reference_fault_set.issubset(comparison_fault_set) or comparison_fault_set.issubset(reference_fault_set):
                intersection = reference_fault_set.intersection(comparison_fault_set)
                smaller_set = min(len(reference_fault_set), len(comparison_fault_set))
                subset_similarity = len(intersection) / smaller_set
                return 0.4 * subset_similarity

            return 0.0

        except Exception as e:
            logger.error("Error in fault similarity calculation: %s", e)
            return 0.0
    
    def calculate_combined_similarity(self, reference_df: pd.DataFrame, comparison_df: pd.DataFrame,
                                    variables: List[str], fault_weight: float = 0.3,
                                    reference_faults: Optional[List[str]] = None,
                                    comparison_faults: Optional[List[str]] = None) -> float:
        """
        Calculate combined similarity using both telemetry and fault data.

        Args:
            reference_df: Reference drive telemetry data
            comparison_df: Comparison drive telemetry data
            variables: List of telemetry variables to compare (may include 'fault')
            fault_weight: Weight given to fault similarity (0-1, default 0.3)
            reference_faults: Pre-fetched ordered fault list for the reference drive
            comparison_faults: Pre-fetched ordered fault list for the comparison drive

        Returns:
            float: Combined similarity score (0-1, higher is more similar)
        """
        has_fault = any(var.lower() == 'fault' for var in variables)
        telemetry_variables = [var for var in variables if var.lower() != 'fault']

        fault_similarity = 0.0
        if has_fault and reference_faults is not None and comparison_faults is not None:
            fault_similarity = self.calculate_fault_similarity(reference_faults, comparison_faults)

        telemetry_similarity = self.calculate(reference_df, comparison_df, telemetry_variables) if telemetry_variables else 0.0

        if has_fault and telemetry_variables:
            telemetry_weight = 1.0 - fault_weight
            return float((telemetry_similarity * telemetry_weight) + (fault_similarity * fault_weight))
        elif has_fault:
            return float(fault_similarity)
        else:
            return float(telemetry_similarity)
    
    def preprocess_data(self, df: pd.DataFrame, variables: List[str]) -> pd.DataFrame:
        """
        Preprocess data before similarity calculation.
        
        This base implementation handles common preprocessing:
        - Filters to specified variables
        - Removes rows with all NaN values
        - Optionally normalizes data
        
        Args:
            df: Input dataframe
            variables: Variables to keep
            
        Returns:
            pd.DataFrame: Preprocessed dataframe
        """
        # Filter to specified variables (plus any required columns like sclk)
        available_vars = [var for var in variables if var in df.columns]
        if not available_vars:
            raise ValueError(f"None of the specified variables {variables} found in data")
        
        # Keep sclk for time alignment if present
        keep_columns = available_vars.copy()
        if 'sclk' in df.columns and 'sclk' not in keep_columns:
            keep_columns.append('sclk')
            
        processed_df = df[keep_columns].copy()
        
        # Remove rows where all variables are NaN
        processed_df = processed_df.dropna(subset=available_vars, how='all')
        
        return processed_df
    
    def normalize_data(self, df: pd.DataFrame, variables: List[str]) -> pd.DataFrame:
        """
        Normalize numerical variables to 0-1 range for comparison.
        
        Args:
            df: Input dataframe
            variables: Variables to normalize
            
        Returns:
            pd.DataFrame: Dataframe with normalized variables
        """
        normalized_df = df.copy()
        
        for var in variables:
            if var in df.columns and df[var].dtype in ['float64', 'int64']:
                var_min = df[var].min()
                var_max = df[var].max()
                
                if var_max > var_min:  # Avoid division by zero
                    normalized_df[var] = (df[var] - var_min) / (var_max - var_min)
                else:
                    normalized_df[var] = 0.0
                    
        return normalized_df 