# Data Ingestion Pipeline

This component handles the ETL (Extract, Transform, Load) process for Hindsight.

## Setup

### Prerequisites
- PostgreSQL 17 with TimescaleDB extension
- Python 3.8+
- Run `../dev-start.sh` first to set up database and data structure

### Environment Setup
```bash
cd ingestion
# Virtual environment is already created by dev-start.sh
source venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### Database Configuration
Ensure database is properly configured:
- Database connection details are set in shared configuration
- TimescaleDB extension is enabled
- Schema is created (handled by dev-start.sh)

## Usage

### Basic Ingestion
```bash
# Ingest data for the default sol range (1040-1055)
python ingest.py

# Clear database and re-ingest
python ingest.py --clear
```

### Custom Sol Range
```bash
# Ingest specific sol range
python ingest.py --sol-range 1041 1043

# Clear and ingest custom range
python ingest.py --clear --sol-range 1050 1055
```

### Configuration Check
```bash
# Check current configuration
python ingest.py --config-check
```

## Data Sources

The pipeline reads from:
- `data/pds/best_interp.csv` - Interpolated rover telemetry
- `data/pds/observations.csv` - Observation metadata  
- `data/unlimited_release_m20_data/EVRs/{sol}_evrs.csv` - Event records

## Data Transformations

1. **Telemetry Data:**
   - Calculates tilt from pitch and roll angles
   - Adds computed slip, distance, and slope values

2. **Drive Metadata:**
   - Aggregates telemetry into drive summaries
   - Calculates total distances and time ranges
   - Stores metadata as JSON

3. **EVR Data:**
   - Ingests all EVR records for performance testing
   - Preserves original module, message, and name fields

## Database Schema

The pipeline populates three main tables:
- `sols` - High-level drive metadata
- `drive_telemetry` - Time-series telemetry data
- `evrs` - Event records

See `database/schema.sql` for detailed schema definitions.

## Command Line Options

- `--clear` - Clear database before ingesting
- `--sol-range START END` - Override default sol range
- `--config-check` - Display current configuration

## Environment Configuration

Data paths and database connections are configured through the shared configuration system:
- Database connection: Managed by `shared/config.py`
- Data paths: Automatically resolved relative to project root
- Default sol range: 1040-1055 (configurable via command line)

The ingestion pipeline reads from:
- `data/pds/best_interp.csv` - Interpolated rover telemetry
- `data/pds/observations.csv` - Observation metadata  
- `data/unlimited_release_m20_data/EVRs/` - Event records directory
