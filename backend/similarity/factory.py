"""
Factory for creating similarity strategy instances.
"""

from typing import Dict, Type
from .base import SimilarityStrategy
from .dtw import DTWStrategy
from .knn import KNNStrategy

# Registry of available strategies
STRATEGY_REGISTRY: Dict[str, Type[SimilarityStrategy]] = {
    "dtw": DTWStrategy,
    "knn": KNNStrategy,
}

def get_similarity_strategy(name: str) -> SimilarityStrategy:
    """
    Factory function to create similarity strategy instances.
    
    Args:
        name: Name of the strategy ("dtw", "knn")
        
    Returns:
        SimilarityStrategy: Instance of the requested strategy
        
    Raises:
        ValueError: If strategy name is not recognized
    """
    if name not in STRATEGY_REGISTRY:
        available = ", ".join(STRATEGY_REGISTRY.keys())
        raise ValueError(f"Unknown strategy: {name}. Available strategies: {available}")
    
    strategy_class = STRATEGY_REGISTRY[name]
    return strategy_class()

def list_available_strategies() -> list[str]:
    """
    Get a list of all available similarity strategy names.
    
    Returns:
        List of strategy names
    """
    return list(STRATEGY_REGISTRY.keys()) 