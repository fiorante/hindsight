"""
Similarity search subsystem for Hindsight.

This package implements a pluggable similarity search system using the Strategy pattern.
"""

from .factory import get_similarity_strategy

__all__ = ["get_similarity_strategy"] 