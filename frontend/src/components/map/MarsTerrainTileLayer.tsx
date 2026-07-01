import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_BASE_URL } from '../../api/client';

interface MarsTileLayerProps {
  attribution?: string;
  minZoom: number;
  maxZoom: number;
  maxNativeZoom: number;
  visible?: boolean;
}

// Mars tile layer component (copied from working prototype)
export function MarsTerrainTileLayer({ attribution, minZoom, maxZoom, maxNativeZoom, visible = true }: MarsTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!visible) {
      return;
    }

    const tileLayer = L.tileLayer(`${API_BASE_URL}/map/tiles/{z}/{x}/{y}.png`, {
      attribution: attribution || '',
      tileSize: 256,
      noWrap: true,
      minZoom: minZoom,
      maxZoom: maxZoom,
      maxNativeZoom: maxNativeZoom,
      updateWhenIdle: false, // Changed from true to false to prevent grey tiles on tab switch
      updateWhenZooming: true, // Changed from false to true for better responsiveness
      keepBuffer: 4, // Increased from 2 to 4 for better tile retention
      className: 'mars-tile-layer'
    });

    tileLayer.addTo(map);

    return () => {
      map.removeLayer(tileLayer);
    };
  }, [map, attribution, minZoom, maxZoom, maxNativeZoom, visible]);

  return null;
}