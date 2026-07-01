"""
Business logic for similarity search operations.
"""

from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models import SimilarityRequest, SimilaritySearchResponse, SimilarityResult
from database.repositories.sol_repository import SolRepository
from database.repositories.telemetry_repository import TelemetryRepository
from database.repositories.map_repository import MapRepository
from database.repositories.fault_repository import FaultRepository
from similarity import get_similarity_strategy


class SimilarityService:
    """Service for similarity search business logic."""

    def __init__(self, db: Session):
        self.db = db
        self.sol_repo = SolRepository(db)
        self.telemetry_repo = TelemetryRepository(db)
        self.map_repo = MapRepository(db)
        self.fault_repo = FaultRepository(db)
    
    def perform_similarity_search(self, request: SimilarityRequest) -> SimilaritySearchResponse:
        """Perform similarity search to find segments similar to a reference."""
        try:
            # Get reference data and metadata
            reference_metadata = None
            
            if request.reference.type == "sol":
                # Get sol boundaries and use as segment
                reference_sol = int(request.reference.value)
                sol_metadata = self.sol_repo.get_sol_metadata(reference_sol)
                
                if sol_metadata is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Reference sol {reference_sol} not found"
                    )
                
                start_sclk = int(sol_metadata['start_sclk'])
                end_sclk = int(sol_metadata['end_sclk'])
                reference_df = self.telemetry_repo.get_drive_telemetry(start_sclk, end_sclk)
                reference_metadata = self.map_repo.get_segment_metadata(start_sclk, end_sclk)
                
            elif request.reference.type == "segment":
                # Use provided SCLK range
                segment_data = request.reference.value
                start_sclk = int(segment_data["start_sclk"])
                end_sclk = int(segment_data["end_sclk"])
                reference_df = self.telemetry_repo.get_drive_telemetry(start_sclk, end_sclk)
                reference_metadata = self.map_repo.get_segment_metadata(start_sclk, end_sclk)
                
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reference type must be 'sol' or 'segment'"
                )
            
            if reference_df.empty:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No telemetry data found for reference"
                )
            
            # Get all available sols for comparison
            sols_df = self.sol_repo.get_sols_for_similarity_search()
            
            if sols_df.empty:
                return SimilaritySearchResponse(
                    reference_metadata=reference_metadata,
                    algorithm=request.config.algorithm,
                    variables=request.config.variables,
                    results=[],
                    total_results=0
                )
            
            # Get similarity strategy
            strategy = get_similarity_strategy(request.config.algorithm)

            # Determine if this search involves fault data
            has_fault_var = any(v.lower() == 'fault' for v in request.config.variables)
            telemetry_vars_present = any(v.lower() != 'fault' for v in request.config.variables)

            # Pre-fetch reference fault sequence once (avoids per-comparison DB queries)
            reference_faults = self.fault_repo.get_faults_for_sclk_range(start_sclk, end_sclk) if has_fault_var else None

            # Calculate similarities
            results = []

            # Get sols that the reference segment covers (for segment-based searches)
            reference_sols_covered = []
            if request.reference.type == "segment":
                reference_sols_covered = reference_metadata.sols_covered if reference_metadata else []

            for _, sol_row in sols_df.iterrows():
                comparison_sol = int(sol_row['sol'])

                # Skip self-comparison for sol-based reference
                if (request.reference.type == "sol" and
                        comparison_sol == int(request.reference.value)):
                    continue

                # Skip sols covered by the reference segment
                if (request.reference.type == "segment" and
                        comparison_sol in reference_sols_covered):
                    continue

                # Get comparison sol telemetry
                comp_start_sclk = int(sol_row['start_sclk'])
                comp_end_sclk = int(sol_row['end_sclk'])
                comparison_df = self.telemetry_repo.get_drive_telemetry(comp_start_sclk, comp_end_sclk)

                if comparison_df.empty:
                    continue

                # Fetch comparison fault sequence if needed
                comparison_faults = self.fault_repo.get_faults_for_sclk_range(comp_start_sclk, comp_end_sclk) if has_fault_var else None

                # Calculate combined similarity (telemetry + faults)
                similarity_score = strategy.calculate_combined_similarity(
                    reference_df, comparison_df, request.config.variables, request.config.fault_weight,
                    reference_faults=reference_faults, comparison_faults=comparison_faults
                )
                
                # Apply distance threshold if specified
                if (request.config.distance_threshold is not None and 
                    similarity_score < (1.0 - request.config.distance_threshold)):
                    continue
                
                # For fault-only searches, exclude zero-similarity results entirely
                if has_fault_var and not telemetry_vars_present and similarity_score <= 0.0:
                    continue

                # Create result with sol metadata
                results.append(SimilarityResult(
                    sol=comparison_sol,
                    similarity_score=similarity_score,
                    distance=float(sol_row['distance']) if sol_row['distance'] is not None else None,
                    duration=float(sol_row['duration']) if sol_row['duration'] is not None else None,
                    point_count=int(sol_row['point_count']) if sol_row['point_count'] is not None else None
                ))
            
            # Sort by similarity score (descending) and limit results
            results.sort(key=lambda x: x.similarity_score, reverse=True)
            limited_results = results[:request.config.max_results]
            
            return SimilaritySearchResponse(
                reference_metadata=reference_metadata,
                algorithm=request.config.algorithm,
                variables=request.config.variables,
                results=limited_results,
                total_results=len(limited_results)
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Similarity search failed: {str(e)}"
            )
