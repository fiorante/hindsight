// Terrain Types and Constants
export const TERRAIN_TYPES = {
  BEDROCK: "Bedrock",
  CRATER: "Crater",
  ROCK_FIELD: "Rock Field",
  SAND: "Sand",
  SAND_DUNE: "Sand Dune",
  SOIL: "Soil"
} as const;

export type TerrainType = keyof typeof TERRAIN_TYPES;

export const TERRAIN_OPERATORS = {
  primarily: "Primarily",
  includes: "Includes",
  does_not_include: "Does Not Include"
} as const;

export type TerrainOperator = keyof typeof TERRAIN_OPERATORS;

// API Response Types
export interface SolListItem {
  sol: number;
  distance: number;
  start_sclk: number;
  end_sclk: number;
  duration: number;
  point_count: number;
}



export interface EVRRecord {
  log_num: number;
  sclk: number;
  module: string;
  message: string;
  name: string;
  event_id: number | null;
  level?: string | null;
}

export interface FaultRecord {
  sclk: number;
  fault_type: string;
}

// PDI (Post Drive Imagery) Types
export interface PDIImage {
  filename?: string;
  sclk?: number;
  description: string;
}

export interface PDICameraSet {
  left?: PDIImage;
  right?: PDIImage;
  camera_type: string;
  description: string;
}

export interface SolPDI {
  sol: number;
  fhaz: PDICameraSet;
  rhaz: PDICameraSet;
  ncam: PDICameraSet;
}

export interface SolData {
  sol: number;
  distance: number;
  start_sclk: number;
  end_sclk: number;
  duration: number;
  evrs: EVRRecord[];
  pdi?: SolPDI;
}

export interface SimilarityResult {
  sol: number;
  similarity_score: number;
  distance: number;
  duration: number;
  point_count: number;
  isReference?: boolean; // Flag to indicate if this is a reference sol
}

export interface SimilaritySearchResponse {
  reference_metadata: {
    type: string;
    value: number;
    distance: number;
    duration: number;
    point_count: number;
  };
  algorithm: string;
  variables: string[];
  results: SimilarityResult[];
  total_results: number;
}

// Request Types
export interface SimilarityRequest {
  reference: {
    type: "sol";
    value: number;
  } | {
    type: "segment";
    value: {
      start_sclk: number;
      end_sclk: number;
    };
  };
  config: {
    algorithm: "dtw" | "knn";
    variables: string[];
    max_results?: number;
    fault_weight?: number;
  };
}

export interface FilterCondition {
  field: string;
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "like" | "primarily" | "includes" | "does_not_include";
  value: any;
}

export interface ExplicitQueryRequest {
  filters: FilterCondition[];
  sol_range?: [number, number];
  order_by?: string;
  order_desc?: boolean;
  limit?: number;
}

// UI State Types
export interface UIFilter {
  type: string;
  active: boolean;
}

export interface ParameterFilter {
  parameter: string;
  min?: string;
  max?: string;
  value?: string;
}

// VCE Types
export interface VCEImage {
  sclk: number;
  left_filename?: string;
  right_filename?: string;
}

export interface SolVCE {
  sol: number;
  images: VCEImage[];
} 