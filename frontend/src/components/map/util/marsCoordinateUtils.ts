// Mars map projection parameters from XML metadata
// These define the geographic bounds and projection of the image
export const MARS_MAP_BOUNDS = {
  west: 77.25338372796834,   // degrees
  east: 77.47215676466411,   // degrees  
  north: 18.50823447169246,  // degrees
  south: 18.41865155989587,  // degrees
};

// Image dimensions from the Mars orbital map
export const IMAGE_DIMENSIONS: [number, number] = [49200, 21240];

/**
 * Convert Mars latitude/longitude to image pixel coordinates.
 * Based on the working interactive_map implementation.
 */
export function latLngToPixel(lat: number, lng: number): [number, number] {
  const [width, height] = IMAGE_DIMENSIONS;

  // Convert from geographic to normalized coordinates
  const normX = (lng - MARS_MAP_BOUNDS.west) / (MARS_MAP_BOUNDS.east - MARS_MAP_BOUNDS.west);
  const normY = (MARS_MAP_BOUNDS.north - lat) / (MARS_MAP_BOUNDS.north - MARS_MAP_BOUNDS.south);

  // Convert to pixel coordinates
  const pixelX = normX * (width - 1);
  const pixelY = normY * (height - 1);

  return [pixelX, pixelY];
}

/**
 * Convert image pixel coordinates to Mars latitude/longitude.
 * Inverse of latLngToPixel function.
 */
export function pixelToLatLng(pixelX: number, pixelY: number): [number, number] {
  const [width, height] = IMAGE_DIMENSIONS;

  // Normalize pixel coordinates to [0, 1]
  const normX = width > 1 ? pixelX / (width - 1) : 0;
  const normY = height > 1 ? pixelY / (height - 1) : 0;

  // Convert to geographic coordinates using equirectangular projection
  const longitude = MARS_MAP_BOUNDS.west + normX * (MARS_MAP_BOUNDS.east - MARS_MAP_BOUNDS.west);
  const latitude = MARS_MAP_BOUNDS.north - normY * (MARS_MAP_BOUNDS.north - MARS_MAP_BOUNDS.south);

  return [latitude, longitude];
}

/**
 * Convert Leaflet bounds (in pixel coordinates) to geographic bounds
 */
export function leafletBoundsToGeographic(bounds: L.LatLngBounds): {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
} {
  // Leaflet bounds use [-pixelY, pixelX] format
  const southwest = bounds.getSouthWest(); // [-maxPixelY, minPixelX]
  const northeast = bounds.getNorthEast(); // [-minPixelY, maxPixelX]

  // Convert back to pixel coordinates (remember Y-axis inversion)
  const minPixelX = southwest.lng;
  const maxPixelX = northeast.lng;
  const minPixelY = -northeast.lat;
  const maxPixelY = -southwest.lat;

  // Convert to geographic coordinates
  const [minLat, minLng] = pixelToLatLng(minPixelX, maxPixelY);
  const [maxLat, maxLng] = pixelToLatLng(maxPixelX, minPixelY);

  return {
    min_lat: Math.min(minLat, maxLat),
    max_lat: Math.max(minLat, maxLat),
    min_lng: Math.min(minLng, maxLng),
    max_lng: Math.max(minLng, maxLng),
  };
}

// Utility function to validate [lat, lng] arrays
export function isValidLatLng(latlng: any): latlng is [number, number] {
  return (
    Array.isArray(latlng) &&
    latlng.length === 2 &&
    typeof latlng[0] === 'number' &&
    typeof latlng[1] === 'number' &&
    !isNaN(latlng[0]) &&
    !isNaN(latlng[1])
  );
}