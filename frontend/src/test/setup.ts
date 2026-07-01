import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Leaflet for map components
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn(),
    bindPopup: vi.fn(),
  })),
  popup: vi.fn(() => ({
    setLatLng: vi.fn(),
    openOn: vi.fn(),
  })),
  icon: vi.fn(),
  divIcon: vi.fn(),
  latLng: vi.fn((lat, lng) => ({ lat, lng })),
  latLngBounds: vi.fn(),
  CRS: {
    Simple: {},
  },
}))

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(({ children }) => children),
  TileLayer: vi.fn(() => null),
  Marker: vi.fn(() => null),
  Popup: vi.fn(() => null),
  useMap: vi.fn(() => ({
    setView: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  })),
  useMapEvents: vi.fn(() => ({})),
}))

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:5173/',
    origin: 'http://localhost:5173',
    pathname: '/hindsight/map',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
})
