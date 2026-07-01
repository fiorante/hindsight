# Hindsight

Hindsight is a web-based platform for analyzing Mars rover drive data. It was built to support rover operations research at JPL and is released here as a reference implementation accompanying our research.

The tool lets operators and researchers explore historical drive data from the Mars 2020 Perseverance rover — searching for similar past drives, visualizing paths on orbital imagery, inspecting telemetry channels, and reviewing drive events (EVRs, mobility faults) in context. The goal is to make it easier to find relevant precedents and identify patterns across a mission's drive history.

This repository is a snapshot released for transparency and reproducibility. It is not actively maintained and we are not accepting contributions.

## Development Setup

There are two ways to run the Hindsight platform:

### Option 1: Local Development (Recommended for development)

For local development with direct access to source code and hot reloading:

```bash
./dev-start.sh
```

This will:
- Check for PostgreSQL and TimescaleDB (provides installation guidance if missing)
- Create database schema with TimescaleDB extension
- Set up Python virtual environments for backend and ingestion
- Install Python dependencies
- Ingest Mars rover data (sols 1040-1055)
- Download and process Mars map tiles
- Generate rover path data at multiple detail levels
- Run system validation tests

**Note**: If you need to reset everything, use `./dev-start.sh --clear`

### Option 2: Docker Containerized Development

For containerized development with isolated environments:

```bash
./docker-start.sh start
```

This will:
- Build and start all services in Docker containers
- Automatically ingest data on first startup
- Provide isolated development environments
- Enable easy deployment and sharing

See [Docker Setup Guide](README.docker.md) for detailed Docker documentation.

### Prerequisites

**For Local Development:**
- Python 3.8+
- PostgreSQL 17 with TimescaleDB extension
- Node.js 18+ (for frontend)

**For Docker Development:**
- Docker and Docker Compose

### Starting the Services (Local Development)

After running `./dev-start.sh`, start the services manually:

**Backend API:**
```bash
cd backend
source venv/bin/activate
python main.py
```
API available at: http://127.0.0.1:8000

**Frontend:**
```bash
cd frontend
npm install  # If not already done
npm run dev
```
Frontend available at: http://localhost:5173

**Note**: For Docker development, services start automatically with `./docker-start.sh start`

## Data

The sample dataset covers sols 1040–1055 of the Mars 2020 Perseverance mission and is enough to explore all features. `dev-start.sh` downloads it automatically on first run.

The dataset is archived on Zenodo (DOI: [`10.5281/zenodo.21094815`](https://doi.org/10.5281/zenodo.21094815)) and contains:
- Pre-rendered HiRISE orbital map tiles (~690 MB)
- Post Drive Imagery from front/rear hazcams and navcam (~205 MB)
- Visual Context Event stereo imagery (~1.5 GB)

Rover path GeoJSON files and database telemetry are included in this repository.

**Note on missing data:** Not all data used in the original system could be released as open source. In particular, rover pose, mobility, and motor telemetry are absent from this release. Features that depend on that data (such as detailed wheel and suspension telemetry charts) will show empty panels.

**To re-run ingestion from raw PDS source files**, see `ingestion/README.md` for the expected directory layout. Raw telemetry data for Mars 2020 is publicly available from the [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/).

## Configuration

Copy `.env.example` to `.env` and update the values for your environment:

```bash
cp .env.example .env
```

## Architecture

```
├── backend/           # FastAPI REST server with map tiles
├── frontend/          # React app with Leaflet maps
├── ingestion/         # Data processing pipeline
├── database/          # PostgreSQL schema
└── shared/            # Configuration utilities
```

## Key Features

- **Similarity Search**: Find similar drives using DTW and k-NN algorithms
- **Interactive Mars Map**: Leaflet-based map with rover path visualization and multiple detail levels
- **Real-time Data**: Live telemetry and EVR event data with filtering capabilities
- **Multi-view Interface**: Simultaneous map, chart, and data analysis views
- **URL State Sync**: Shareable URLs maintaining current analysis state
- **Image Integration**: Drive-related imagery display and gallery functionality
- **Responsive UI**: Modern React interface optimized for data exploration

## API Documentation

- **Interactive docs**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc 