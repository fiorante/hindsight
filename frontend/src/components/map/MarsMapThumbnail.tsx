import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useDriveState } from '../providers/DriveStateProvider';
import { MarsTerrainTileLayer } from './MarsTerrainTileLayer';
import { RoverPathLayer } from './RoverPathLayer';
import { latLngToPixel } from './util/marsCoordinateUtils';
import type { MapViewProps, MapBounds, RoverPathData } from './util/marsMapTypes';
import { API_BASE_URL } from '../../api/client';

// Simple map controller for thumbnail mode
function ThumbnailMapController({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    // Signal that the map is ready
    onMapReady(map);
  }, [onMapReady, map]);

  return null;
}

export function MarsMapThumbnail({
  focusDrive,
  onMapReady,
}: Partial<MapViewProps> & { focusDrive?: string; onMapReady?: () => void }) {
  const hasFocusedRef = useRef<string | null>(null);
  const driveState = useDriveState();

  const selectedDrives = driveState.selectedDrives;
  const searchResults = driveState.searchResults;
  const onDriveSelect = driveState.toggleDriveSelection;

  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [roverPathData, setRoverPathData] = useState<RoverPathData | null>(null);
  const [solsData, setSolsData] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Load map bounds
  useEffect(() => {
    fetch(`${API_BASE_URL}/map/rover-path/sols`)
      .then(res => res.json())
      .then(setSolsData)
      .catch(console.error);

    fetch(`${API_BASE_URL}/map/bounds`)
      .then(res => res.json())
      .then(setMapBounds)
      .catch(console.error);
  }, []);

  const handleMapReady = useCallback((map: L.Map) => {
    if (map && map.getContainer() && !mapInstance) {
      setMapInstance(map);
    }
  }, [mapInstance]);

  // Load and focus specific drive data for thumbnails
  useEffect(() => {
    if (focusDrive && solsData && mapInstance && mapInstance.getContainer()) {
      if (hasFocusedRef.current === focusDrive) {
        return;
      }

      const solData = solsData.sols[focusDrive];
      if (solData) {
        const startLat = solData.start_point.latitude;
        const startLng = solData.start_point.longitude;
        const endLat = solData.end_point.latitude;
        const endLng = solData.end_point.longitude;

        const minLat = Math.min(startLat, endLat) - 0.01;
        const maxLat = Math.max(startLat, endLat) + 0.01;
        const minLng = Math.min(startLng, endLng) - 0.01;
        const maxLng = Math.max(startLng, endLng) + 0.01;

        const url = `${API_BASE_URL}/map/rover-path?detail=high&min_lat=${minLat}&max_lat=${maxLat}&min_lng=${minLng}&max_lng=${maxLng}`;

        fetch(url)
          .then(res => res.json())
          .then(data => {
            setRoverPathData(data);

            try {
              // Center on the drive
              const centerLat = (startLat + endLat) / 2;
              const centerLng = (startLng + endLng) / 2;
              const [centerPixelX, centerPixelY] = latLngToPixel(centerLat, centerLng);
              const leafletCenter: [number, number] = [-centerPixelY, centerPixelX];

              // Check if start and end points are visible
              const currentBounds = mapInstance.getBounds();
              if (!currentBounds) return;
              const [startPixelX, startPixelY] = latLngToPixel(startLat, startLng);
              const [endPixelX, endPixelY] = latLngToPixel(endLat, endLng);
              const startLeaflet: [number, number] = [-startPixelY, startPixelX];
              const endLeaflet: [number, number] = [-endPixelY, endPixelX];

              const startInBounds = currentBounds.contains(startLeaflet);
              const endInBounds = currentBounds.contains(endLeaflet);
              const targetZoom = (!startInBounds || !endInBounds) ? -3 : -2;

              mapInstance.setView(leafletCenter, targetZoom, { animate: false });
              hasFocusedRef.current = focusDrive;

              if (onMapReady) {
                setTimeout(() => onMapReady(), 50);
              }
            } catch (error) {
              console.error('Error setting map view:', error);
            }
          })
          .catch(console.error);
      }
    }
  }, [focusDrive, solsData, mapInstance, onMapReady]);

  if (!mapBounds) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading...</div>
      </div>
    );
  }

  const { center } = mapBounds;
  const [centerPixelX, centerPixelY] = latLngToPixel(center.lat, center.lng);
  const mapCenter: [number, number] = [-centerPixelY, centerPixelX];

  return (
    <div className="w-full h-full relative" style={{ overflow: 'hidden' }}>
      <MapContainer
        center={mapCenter}
        zoom={-2}
        minZoom={mapBounds.minZoom}
        maxZoom={mapBounds.maxZoom}
        zoomSnap={0.5}
        style={{ height: '100%', width: '100%' }}
        crs={L.CRS.Simple}
        zoomControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        <MarsTerrainTileLayer
          minZoom={mapBounds.minZoom}
          maxZoom={mapBounds.maxZoom}
          maxNativeZoom={mapBounds.maxNativeZoom}
          visible={true}
        />

        <ThumbnailMapController onMapReady={handleMapReady} />

        {roverPathData && (
          <RoverPathLayer
            roverPathData={roverPathData}
            selectedDrives={selectedDrives}
            onDriveSelect={onDriveSelect}
            focusDrive={focusDrive}
            searchResults={searchResults}
            isThumbnail={true}
            enableSegmentSelection={false}
          />
        )}
      </MapContainer>
    </div>
  );
}