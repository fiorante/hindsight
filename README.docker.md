# Hindsight Docker Setup

This document provides instructions for running the Hindsight platform using Docker containers.

## Development Options

The Hindsight platform supports two development approaches:

1. **Local Development** (`./dev-start.sh`): Direct installation on your system with hot reloading
2. **Docker Development** (`./docker-start.sh`): Containerized development with isolated environments

This guide covers the Docker approach. For local development, see the main [README.md](README.md).

## Quick Start

### Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- At least 4GB of available RAM
- At least 10GB of available disk space

### 1. Environment Setup

Copy the environment template and customize as needed:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start the Platform

Use the convenient startup script:

```bash
# Start all services with automatic data ingestion if needed
./docker-start.sh start

# Or start in production mode
./docker-start.sh start --prod

# Force rebuild of images
./docker-start.sh start --build
```

### 3. Access the Application

- **Frontend**: http://localhost:5173 (development) or http://localhost (production)
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Available Commands

The `docker-start.sh` script provides several convenient commands:

```bash
# Start services
./docker-start.sh start [--dev|--prod] [--build]

# Stop services
./docker-start.sh stop

# View logs
./docker-start.sh logs [service_name]

# Open shell in container
./docker-start.sh shell [service_name]

# Run data ingestion (manual)
./docker-start.sh ingest

# Force data ingestion (overwrites existing data)
./docker-start.sh force-ingest

# Reset database and re-ingest data
./docker-start.sh reset

# Show service status
./docker-start.sh status
```

## Manual Docker Commands

If you prefer to use Docker Compose directly:

### Development Mode

```bash
# Start core services
docker-compose up -d database backend frontend

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Mode

```bash
# Start with production profile
docker-compose --profile production up -d

# This includes nginx reverse proxy
```

### Data Ingestion

The platform automatically handles data ingestion:

- **First startup**: Automatically runs data ingestion if the database is empty
- **Subsequent startups**: Skips ingestion if data already exists
- **Manual ingestion**: Use `./docker-start.sh ingest` to run ingestion manually
- **Force ingestion**: Use `./docker-start.sh force-ingest` to overwrite existing data

```bash
# Manual data ingestion (one-time)
docker-compose --profile ingestion run --rm ingestion
```

## Services Overview

### Database Service (`database`)
- **Image**: `timescale/timescaledb:2.13.0-pg16`
- **Port**: 5432
- **Volume**: `database_data` (persistent storage)
- **Environment**: PostgreSQL with TimescaleDB extension

### Backend Service (`backend`)
- **Build**: `./backend/Dockerfile`
- **Port**: 8000
- **Dependencies**: Database
- **Features**: FastAPI with hot-reload in development

### Frontend Service (`frontend`)
- **Build**: `./frontend/Dockerfile.dev` (development) or `./frontend/Dockerfile` (production)
- **Port**: 5173 (dev) or 80 (prod)
- **Dependencies**: Backend
- **Features**: React with Vite dev server

### Ingestion Service (`ingestion`)
- **Build**: `./ingestion/Dockerfile`
- **Profile**: `ingestion` (manual start only)
- **Dependencies**: Database
- **Purpose**: ETL pipeline for Mars rover data

### Nginx Service (`nginx`)
- **Build**: `./nginx/Dockerfile`
- **Port**: 80, 443
- **Profile**: `production`
- **Purpose**: Reverse proxy and load balancer

## Data Management

### Persistent Volumes

- `database_data`: PostgreSQL database files
- `backend_data`: Backend application data (maps, images, etc.)

### Data Ingestion

The ingestion service processes Mars rover data from the `../data` directory. Ensure this directory contains:

- `pds/best_interp.csv`
- `pds/best_tactical.csv`
- `unlimited_release_m20_data/` (EVR and telemetry files)

### Resetting Data

To completely reset the database and re-ingest data:

```bash
./docker-start.sh reset
```

This will:
1. Stop all services
2. Remove the database volume
3. Restart the database
4. Run data ingestion
5. Start all services

## Development Workflow

### Hot Reload

Both backend and frontend support hot reload in development mode:

- **Backend**: FastAPI with uvicorn `--reload`
- **Frontend**: Vite dev server with HMR

### Debugging

Open a shell in any container:

```bash
# Backend container
./docker-start.sh shell backend

# Frontend container
./docker-start.sh shell frontend

# Database container
./docker-start.sh shell database
```

### Logs

View logs for debugging:

```bash
# All services
./docker-start.sh logs

# Specific service
./docker-start.sh logs backend
```

## Production Deployment

### Production Mode

Start with production configuration:

```bash
./docker-start.sh start --prod
```

This enables:
- Nginx reverse proxy
- Optimized frontend build
- Production database settings
- Container health checks

### Environment Variables

For production, update the `.env` file with:

```bash
DEBUG=false
NODE_ENV=production
DB_PASSWORD=<secure_password>
```

### SSL/HTTPS

To enable HTTPS, update the nginx configuration to include SSL certificates and modify the `docker-compose.yml` to mount certificate files.

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5432, 8000, and 5173 are available
2. **Memory issues**: Increase Docker memory limit to at least 4GB
3. **Permission issues**: Ensure Docker has access to the data directory

### Database Connection Issues

```bash
# Check database status
./docker-start.sh shell database
psql -U hindsight -d drive_analysis -c "SELECT version();"
```

### Building Issues

```bash
# Clean build
docker-compose down
docker system prune -f
./docker-start.sh start --build
```

### Data Issues

```bash
# Check data ingestion logs
./docker-start.sh logs ingestion

# Re-run ingestion
./docker-start.sh ingest
```

## Performance Optimization

### Resource Limits

Adjust Docker Compose resource limits as needed:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

### Database Tuning

For production workloads, consider tuning TimescaleDB:

```bash
./docker-start.sh shell database
timescaledb-tune --quiet --yes
```
