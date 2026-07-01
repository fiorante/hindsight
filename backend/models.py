"""
Pydantic models for the Hindsight API.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional, Literal, Union
from datetime import datetime
import math

# Response Models
class SolListItem(BaseModel):
    """Metadata for a single sol in the list view."""
    sol: int
    distance: Optional[float] = None
    start_sclk: int
    end_sclk: int
    duration: Optional[float] = None
    point_count: Optional[int] = None

class TelemetryPoint(BaseModel):
    """A single telemetry data point."""
    sclk: int
    easting: Optional[float] = None
    northing: Optional[float] = None
    elevation: Optional[float] = None
    slope: Optional[float] = None
    heading: Optional[float] = None
    velocity: Optional[float] = None
    terrain: Optional[str] = None

class EVRRecord(BaseModel):
    """An event record."""
    log_num: int
    sclk: int
    module: Optional[str] = None
    message: str
    name: Optional[str] = None
    event_id: Optional[int] = None
    level: Optional[str] = None

class FaultRecord(BaseModel):
    """A mobility fault record."""
    sclk: int
    fault_type: str

class FacetItem(BaseModel):
    value: str
    count: int

class EVRStreamResponse(BaseModel):
    items: List[EVRRecord]
    next_cursor_sclk: Optional[int] = None
    next_cursor_log: Optional[int] = None
    prev_cursor_sclk: Optional[int] = None
    prev_cursor_log: Optional[int] = None
    total_returned: int

class EVRFacetsResponse(BaseModel):
    modules: List[FacetItem] = []
    names: List[FacetItem] = []
    levels: List[FacetItem] = []

class MobilityTelemetryPoint(BaseModel):
    """A single mobility system telemetry point."""
    sclk: int
    bogie_l: Optional[float] = None
    bogie_r: Optional[float] = None
    diff_l: Optional[float] = None
    diff_r: Optional[float] = None
    accel_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_x: Optional[float] = None
    accel_y: Optional[float] = None
    accel_z: Optional[float] = None
    pitch: Optional[float] = None
    pos_z: Optional[float] = None
    accel_pitch: Optional[float] = None
    roll: Optional[float] = None
    yaw: Optional[float] = None
    tilt: Optional[float] = None
    accel_tilt: Optional[float] = None
    accel_roll: Optional[float] = None
    elapsed_time: Optional[float] = None
    raw_accel_z: Optional[float] = None
    raw_accel_x: Optional[float] = None
    raw_accel_y: Optional[float] = None

    @field_validator('*', mode='before')
    @classmethod
    def handle_nan_values(cls, v):
        """Convert NaN and infinite values to None for JSON serialization."""
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v

class MotorTelemetryPoint(BaseModel):
    """A single motor telemetry point."""
    sclk: int
    motor_name: str
    odom: Optional[float] = None
    angle: Optional[float] = None
    voltage: Optional[float] = None
    field: Optional[float] = None
    state: Optional[float] = None
    cbrake_ma: Optional[float] = None
    cmotor: Optional[float] = None
    cstatus: Optional[float] = None
    cbrake_status: Optional[float] = None
    tprt1: Optional[float] = None
    angular_rate: Optional[float] = None

    @field_validator('*', mode='before')
    @classmethod
    def handle_nan_values(cls, v):
        """Convert NaN and infinite values to None for JSON serialization."""
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return v

class PDIImage(BaseModel):
    """A single PDI image with metadata."""
    filename: Optional[str] = None
    sclk: Optional[int] = None
    description: str

class PDICameraSet(BaseModel):
    """A set of left and right images for one camera."""
    left: Optional[PDIImage] = None
    right: Optional[PDIImage] = None
    camera_type: str  # "fhaz", "rhaz", "ncam"
    description: str  # "Front Hazcam", "Rear Hazcam", "Navcam"

class SolPDI(BaseModel):
    """PDI data for a sol."""
    sol: int
    fhaz: PDICameraSet
    rhaz: PDICameraSet
    ncam: PDICameraSet

class SolData(BaseModel):
    """Complete sol data including metadata, telemetry, EVRs, and PDI."""
    sol: int
    distance: Optional[float] = None
    start_sclk: int
    end_sclk: int
    duration: Optional[float] = None
    point_count: Optional[int] = None
    telemetry: List[TelemetryPoint] = []
    evrs: List[EVRRecord] = []
    pdi: Optional[SolPDI] = None

class SegmentMetadata(BaseModel):
    """Metadata for a drive segment."""
    start_sclk: int
    end_sclk: int
    duration: float
    point_count: int
    distance: Optional[float] = None
    sols_covered: List[int] = []

class SimilarityResult(BaseModel):
    """Result item from similarity search."""
    sol: int
    similarity_score: float
    distance: Optional[float] = None
    duration: Optional[float] = None
    point_count: Optional[int] = None

class SimilaritySearchResponse(BaseModel):
    """Response from similarity search endpoint."""
    reference_metadata: SegmentMetadata
    algorithm: str
    variables: List[str]
    results: List[SimilarityResult]
    total_results: int

# Request Models
class SimilarityReference(BaseModel):
    """Reference for similarity search - either a sol number or drive segment."""
    type: Literal["sol", "segment"]
    value: Union[int, Dict[str, int]]  # For segment: {"start_sclk": int, "end_sclk": int}
    
class CoordinatePoint(BaseModel):
    """A coordinate point for nearest SCLK resolution."""
    easting: float
    northing: float

class NearestSCLKResponse(BaseModel):
    """Response from nearest SCLK lookup."""
    sclk: int
    distance: float
    easting: float
    northing: float
    elevation: Optional[float] = None
    terrain: Optional[str] = None

class SegmentValidationResponse(BaseModel):
    """Response from segment validation."""
    valid: bool
    duration: float
    point_count: int
    distance: Optional[float] = None
    sols_covered: List[int] = []
    error: Optional[str] = None

class SimilarityConfig(BaseModel):
    """Configuration for similarity search algorithm."""
    algorithm: Literal["dtw", "knn"] = "dtw"
    variables: List[str] = Field(default=["elevation", "tilt"], 
                                description="Variables to compare")
    max_results: int = Field(default=10, ge=1, le=100,
                           description="Maximum number of results to return")
    distance_threshold: Optional[float] = Field(default=None, ge=0.0,
                                              description="Maximum distance threshold")
    fault_weight: float = Field(default=0.3, ge=0.0, le=1.0,
                               description="Weight given to fault similarity (0-1)")

class SimilarityRequest(BaseModel):
    """Request body for similarity search."""
    reference: SimilarityReference
    config: SimilarityConfig = SimilarityConfig()

class ExplicitQueryFilter(BaseModel):
    """Filter for explicit database queries."""
    field: str
    operator: Literal["eq", "gt", "lt", "gte", "lte", "in", "like", "primarily", "includes", "does_not_include"]
    value: Union[str, int, float, List[Union[str, int, float]]]

class ExplicitQueryRequest(BaseModel):
    """Request body for explicit database queries."""
    filters: List[ExplicitQueryFilter] = []
    sol_range: Optional[tuple[int, int]] = None
    limit: int = Field(default=50, ge=1, le=1000)
    order_by: Optional[str] = None
    order_desc: bool = False

# Telemetry Response Models
class MobilityTelemetryResponse(BaseModel):
    """Response for mobility telemetry data."""
    start_sclk: int
    end_sclk: int
    point_count: int
    telemetry: List[MobilityTelemetryPoint] = []

class MotorTelemetryResponse(BaseModel):
    """Response for motor telemetry data."""
    start_sclk: int
    end_sclk: int
    point_count: int
    motors: Dict[str, List[MotorTelemetryPoint]] = {}

class MotorListResponse(BaseModel):
    """Response for available motors list."""
    motors: List[str] = []
    total_count: int

class ChartDataPoint(BaseModel):
    """A single chart data point.
    For continuous signals, `value` is a float.
    For categorical signals (e.g., terrain), `value` may be a string label.
    """
    sclk: int
    value: Optional[Union[float, str]] = None

class ChartDataResponse(BaseModel):
    """Response containing chart data for a parameter."""
    sol: int
    parameter: str
    data: List[ChartDataPoint]
    min_value: Optional[float] = None
    max_value: Optional[float] = None

# Status and Health Models
class HealthResponse(BaseModel):
    """Health check response."""
    status: Literal["healthy", "unhealthy"]
    database_connected: bool
    timestamp: datetime
    version: str = "1.0.0"

class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    status_code: int

class VCEImage(BaseModel):
    """VCE (Visual Compute Element) stereo image pair."""
    sclk: int
    left_filename: Optional[str] = None
    right_filename: Optional[str] = None

class SolVCE(BaseModel):
    """VCE (Visual Compute Element) images for a specific sol."""
    sol: int
    images: List[VCEImage] 