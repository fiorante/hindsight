"""
Middleware for the Hindsight API.
"""

from .error_handler import add_error_handlers

__all__ = ["add_error_handlers"]
