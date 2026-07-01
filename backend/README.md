# Backend API Server

FastAPI server providing REST endpoints for Mars rover drive analysis, similarity search, and map tile serving.

## Quick Start

### Prerequisites
- Python 3.8+
- PostgreSQL 17 with TimescaleDB extension
- Run `../dev-start.sh` first to set up database and data

### Setup
```bash
cd backend
# Virtual environment is already created by dev-start.sh
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### Start Server
```bash
cd backend
source venv/bin/activate
python main.py
```

Server available at: http://127.0.0.1:8000
API documentation at: http://127.0.0.1:8000/docs

## Backend Structure

```
backend/
├── main.py                # FastAPI application entry point
├── config.py              # Application configuration
├── models.py              # Pydantic data models
├── parameter_config.py    # Parameter definitions
├── routers/               # API endpoint definitions
│   ├── health.py          # Health check endpoints
│   ├── sols.py            # Sol data endpoints
│   ├── search.py          # Similarity search endpoints
│   ├── maps.py            # Map tile and rover path endpoints
│   ├── telemetry.py       # Telemetry data endpoints
│   ├── evrs.py            # Event record endpoints
│   ├── faults.py          # Fault data endpoints
│   └── images.py          # Image serving endpoints
├── services/              # Business logic layer
│   ├── similarity_service.py  # Drive similarity algorithms
│   ├── search_service.py      # Search functionality
│   ├── map_service.py         # Map data processing
│   └── [other services]       # Sol, telemetry, EVR services
├── database/              # Data access layer
│   ├── connection.py      # Database connection management
│   └── repositories/      # Data access objects
├── similarity/            # Similarity algorithm implementations
│   ├── dtw.py             # Dynamic Time Warping
│   ├── knn.py             # k-Nearest Neighbors
│   └── factory.py         # Algorithm factory
├── middleware/            # Request/response middleware
├── utils/                 # Utility functions
├── tests/                 # Test suite
└── data/                  # Static data files
    ├── map_tiles/         # Mars orbital map tiles
    ├── rover_path/        # Precomputed rover path data
    ├── pdi/               # Product Data Image files
    └── vce/               # Visual Context Event files
```

## API Endpoints

### Core Data
- `GET /sols/list` - List all available sols
- `GET /sols/{sol}` - Get complete sol data (telemetry + EVRs)
- `GET /health` - Health check

### Search
- `POST /query/similar` - Similarity search using DTW or k-NN
- `POST /query/explicit` - Parameter-based filtering

### Map & Visualization
- `GET /map/bounds` - Mars map boundaries
- `GET /map/tiles/{z}/{x}/{y}.png` - Mars orbital map tiles
- `GET /map/rover-path` - Rover path data (low/medium/high detail)
- `GET /map/rover-path/sols` - Sol boundary information

### Telemetry
- `GET /telemetry/mobility` - Mobility telemetry data
- `GET /telemetry/motors` - Motor telemetry data

### Images
- `GET /images/pdi/{filename}` - Product Data Images
- `GET /images/vce/{filename}` - Visual Context Event images

### Event Records
- `GET /evrs` - Event record data with filtering

## Similarity Search

Find drives similar to a reference using DTW or k-NN algorithms:

```bash
curl -X POST http://127.0.0.1:8000/query/similar \
  -H "Content-Type: application/json" \
  -d '{
    "reference": {"type": "sol", "value": 1041},
    "config": {"algorithm": "dtw", "variables": ["elevation"]}
  }'
```

## Development

### Testing
```bash
# Run tests
cd backend
source venv/bin/activate
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_services.py -v
```

### Dependencies
- **FastAPI**: Modern web framework for building APIs
- **SQLAlchemy**: Database ORM with TimescaleDB support
- **Pandas/NumPy**: Data processing and analysis
- **DTAIDistance**: Dynamic Time Warping implementation
- **Scikit-learn**: Machine learning algorithms

## Documentation

- **Interactive API docs**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc
