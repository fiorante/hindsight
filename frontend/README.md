# Frontend - Hindsight

React application for visualizing Mars rover drive data with interactive maps and similarity search.

## Quick Start

### Prerequisites
- **Node.js 18+**: Install with `brew install node`
- **Backend API**: Must be running on http://127.0.0.1:8000
- **Database**: Ensure backend database is set up and populated

### Setup & Start Development Server
```bash
cd frontend
npm install
npm run dev
```

App available at: http://localhost:5173

## Frontend Structure

```
frontend/src/
├── main.tsx                 # Application entry point
├── App.tsx                  # Main application component
├── components/              # Reusable UI components
│   ├── drive/              # Drive-specific visualization components
│   │   ├── DrivePanel.tsx          # Main drive analysis interface
│   │   ├── DriveChartView.tsx      # Telemetry charts
│   │   ├── DriveEvrsView.tsx       # Event records display
│   │   ├── DriveMapView.tsx        # Drive path on map
│   │   └── [other drive components]
│   ├── map/                # Mars map components
│   │   ├── InteractiveMarsMap.tsx  # Main map interface
│   │   ├── RoverPathLayer.tsx      # Rover path visualization
│   │   ├── MarsTerrainTileLayer.tsx # Mars surface tiles
│   │   └── [other map components]
│   ├── search/             # Search interface components
│   │   ├── SearchPanel.tsx         # Search controls
│   │   ├── SearchResults.tsx       # Results display
│   │   └── DriveResultView.tsx     # Individual result view
│   ├── ui/                 # Generic UI components
│   │   ├── parameter-selector/     # Parameter selection controls
│   │   ├── Toast.tsx              # Notification system
│   │   └── [other UI components]
│   └── providers/          # React context providers
├── api/                    # API client and data layer
│   ├── client.ts          # HTTP client configuration
│   ├── repositories/      # Data access layer
│   └── transformers/      # Data transformation utilities
├── hooks/                  # Custom React hooks
│   ├── useSearch.ts       # Search functionality
│   ├── useTelemetry.ts    # Telemetry data management
│   └── [other hooks]
├── state/                  # Global state management
│   ├── store.ts           # Zustand store configuration
│   ├── searchSlice.ts     # Search state
│   └── urlSlice.ts        # URL synchronization
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
└── constants/              # Application constants
```

## Features

- **Interactive Mars Map**: Leaflet-based map with rover path visualization
- **Similarity Search**: Find drives similar to a reference sol using DTW/k-NN
- **Parameter Filtering**: Query drives by specific telemetry conditions
- **Real-time Data**: Live telemetry and EVR event visualization
- **Responsive UI**: Modern interface optimized for data exploration
- **URL State Sync**: Shareable URLs with current view state
- **Multi-view Layout**: Simultaneous map, chart, and data views

## Technology Stack

- **React 18** with TypeScript
- **Leaflet** & **React-Leaflet** for interactive maps
- **TanStack Query** for data fetching and caching
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **React Router** for navigation
- **Vite** for development and building

## Usage

### Similarity Search
1. Select "by sol #" search mode in the search panel
2. Enter reference sol number (e.g., 1041)
3. Choose comparison variables (elevation, slope, motors, etc.)
4. Configure algorithm (DTW or k-NN) and parameters
5. Click "Find Similar Drives"
6. View results in the map and detailed charts

### Interactive Map
- **Zoom/Pan**: Navigate the Mars surface using mouse/touch
- **Click Path Segments**: Select sols for detailed analysis
- **Dynamic Detail**: Path resolution automatically adjusts with zoom level
- **Waypoint Markers**: Click to view sol-specific information

### Drive Analysis
- **Multi-parameter Charts**: View telemetry data across multiple variables
- **Event Timeline**: See EVRs and faults overlaid on telemetry
- **Image Gallery**: Browse drive-related imagery when available
- **Export Functions**: Save chart data and visualizations

## Development

```bash
npm run dev         # Start development server (Vite)
npm run build       # Build for production
npm run lint        # Run ESLint
npm run preview     # Preview production build
npm run test        # Run tests with Vitest
npm run test:ui     # Run tests with UI interface
npm run test:coverage # Generate coverage report
```

### Code Structure Guidelines
- Components are organized by feature domain
- Shared UI components live in `components/ui/`
- API calls are abstracted through repositories
- State management uses Zustand for global state
- Custom hooks encapsulate complex logic

## Troubleshooting

- **Map Not Loading**: Ensure backend is running and serving map tiles at http://127.0.0.1:8000
- **API Errors**: Check backend health at http://127.0.0.1:8000/health  
- **CORS Issues**: Verify backend CORS settings include localhost:5173
- **Search Not Working**: Confirm database has been populated with sol data
- **Missing Images**: Check that PDI/VCE image files are available in backend data directory
