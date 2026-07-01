export interface MapViewProps {
  focusDrive?: string; // Optional drive to focus on and highlight
  initialZoom?: number; // Optional initial zoom level
  showDebugInfo?: boolean; // Optional flag to show debug information
  isThumbnail?: boolean; // Optional flag to render as non-interactive thumbnail
  onMapReady?: () => void; // Optional callback when map is fully loaded and focused
  enableSegmentSelection?: boolean; // Optional flag to enable segment selection mode

  // Legacy props for backward compatibility (will be deprecated)
  selectedDrives?: string[];
  onDriveSelect?: (driveId: string) => void;
  searchResults?: Array<{ sol: number }>;
}

export interface RoverPathPoint {
  longitude: number;
  latitude: number;
  sclk: number | null;
  sol: number;
  index: number;
}

export interface RoverPathData {
  detail_level: string;
  total_points: number;
  original_total_points?: number;
  decimation_factor: number;
  description: string;
  points: RoverPathPoint[];
  bounds_applied?: boolean;
}

export interface MapBounds {
  minZoom: number;
  maxNativeZoom: number;
  maxZoom: number;
  tileSize: number;
  attribution: string;
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
  center: {
    lat: number;
    lng: number;
  };
}