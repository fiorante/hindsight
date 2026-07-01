#!/bin/bash

# Hindsight Quick Start Script
# This script sets up the development environment and validates the system

set -e  # Exit on any error

# Parse command line arguments
CLEAR_DATABASE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --clear)
            CLEAR_DATABASE=true
            shift
            ;;
        *)
            echo "Unknown option $1"
            echo "Usage: $0 [--clear]"
            echo "  --clear    Force database recreation and data re-ingestion"
            exit 1
            ;;
    esac
done

echo "🚀 Hindsight Quick Start"
echo "======================================"

if [ "$CLEAR_DATABASE" = true ]; then
    echo "⚠️  Clear mode enabled - will recreate database and re-ingest data"
fi

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$REPO_ROOT"

echo "📁 Repository root: $REPO_ROOT"

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+."
    exit 1
fi
echo "✅ Python 3 found: $(python3 --version)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL 17:"
    echo "   brew install libpq"
    echo "   brew install postgresql"
    echo "   brew install postgresql@17"
    echo "   brew tap timescale/tap"
    echo "   brew install timescaledb"
    echo ""
    echo "   After installation, follow Homebrew's instructions to set up timescale DB. You will likely need to run:"
    echo "   timescaledb-tune --quiet --yes"
    echo "   timescaledb_move.sh"
    echo ""
    echo "   Also, you will need to add timescaledb to the list of shared_preload_libraries in postgresql.conf. If running on Mac:"
    echo "   echo \"shared_preload_libraries = 'timescaledb'\" >> /opt/homebrew/var/postgresql@17/postgresql.conf"
    echo ""
    echo "   Then, start PostgreSQL:"
    echo "   brew services start postgresql@17"
    exit 1
fi
echo "✅ PostgreSQL found"

# Check TimescaleDB extension
echo "   Checking TimescaleDB extension..."
if psql postgres -c "SELECT 1;" &> /dev/null 2>&1; then
    # Try to check if TimescaleDB extension is available
    if psql postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';" 2>/dev/null | grep -q timescaledb; then
        echo "✅ TimescaleDB extension available"
    else
        echo "⚠️  TimescaleDB extension not found. Please install it:"
        echo "   brew tap timescale/tap"
        echo "   brew install timescaledb"
    fi
else
    echo "⚠️  Cannot connect to PostgreSQL. Make sure it's running:"
    echo "   brew services start postgresql@17"
fi

# Setup ingestion pipeline
echo ""
echo "🔧 Setting up ingestion pipeline..."
cd "$PLATFORM_DIR/ingestion"

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

echo "   Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Ingestion pipeline ready"

# Setup backend API
echo ""
echo "🔧 Setting up backend API..."
cd "$PLATFORM_DIR/backend"

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

echo "   Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Backend API ready"

# Database setup check
echo ""
echo "🔍 Checking database setup..."

cd "$PLATFORM_DIR"

# Load environment variables from .env
if [ -f "$PLATFORM_DIR/.env" ]; then
    # Filter out comments and empty lines, then export
    export $(grep -v '^#' "$PLATFORM_DIR/.env" | grep -v '^$' | xargs)
    echo "✅ Environment configuration loaded from .env"
elif [ -f "$PLATFORM_DIR/.env.example" ]; then
    echo "⚠️  No .env file found — copying from .env.example with defaults"
    cp "$PLATFORM_DIR/.env.example" "$PLATFORM_DIR/.env"
    export $(grep -v '^#' "$PLATFORM_DIR/.env" | grep -v '^$' | xargs)
else
    echo "❌ No .env or .env.example file found in $PLATFORM_DIR"
    exit 1
fi

# Get DATABASE_URL using Python shared config
cd backend
source venv/bin/activate
DATABASE_URL=$(python3 -c "import sys; sys.path.append('..'); from shared.config import get_database_url; print(get_database_url())")
cd ..
echo "🔗 Using database URL: $DATABASE_URL"

# Database setup and recreation
echo ""
echo "🗄️  Setting up database..."

# Force recreation if --clear flag is passed
if [ "$CLEAR_DATABASE" = true ]; then
    echo "🔄 Force recreating database due to --clear flag..."
    SCHEMA_UP_TO_DATE=false
else
    # Check if database exists and can connect
    if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        echo "✅ Database connection successful"
        
        # Check if schema exists and matches expected structure (includes PDI support)
        REQUIRED_TABLES=('sols' 'drive_telemetry' 'evrs' 'pdi_images')
        TABLES_COUNT=0
        
        for table in "${REQUIRED_TABLES[@]}"; do
            if psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" | grep -q "1"; then
                TABLES_COUNT=$((TABLES_COUNT + 1))
            fi
        done
        
        if [ "$TABLES_COUNT" -eq "${#REQUIRED_TABLES[@]}" ]; then
            # Check if we have the new schema (sols table instead of drives table)
            SOLS_TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sols';" | tr -d ' ')
            DRIVES_TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drives';" | tr -d ' ')
            PDI_TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pdi_images';" | tr -d ' ')
            
            if [ "$SOLS_TABLE_CHECK" -eq "1" ] && [ "$DRIVES_TABLE_CHECK" -eq "0" ] && [ "$PDI_TABLE_CHECK" -eq "1" ]; then
                echo "✅ Database schema v3 exists and is up to date (includes PDI support)"
                SCHEMA_UP_TO_DATE=true
            else
                echo "⚠️  Database schema exists but needs updating to v3 (PDI support)"
                SCHEMA_UP_TO_DATE=false
            fi
        else
            echo "⚠️  Database exists but schema is incomplete ($TABLES_COUNT/${#REQUIRED_TABLES[@]} required tables found)"
            SCHEMA_UP_TO_DATE=false
        fi
    else
        echo "⚠️  Database does not exist or connection failed"
        SCHEMA_UP_TO_DATE=false
    fi
fi

# Recreate database if needed
if [ "$SCHEMA_UP_TO_DATE" = false ]; then
    echo "🔄 Recreating database with updated schema..."
    
    # Extract database name from DATABASE_URL
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

    # Create the database role if it doesn't exist (needed on fresh installs)
    DB_USER_PARSED=$(python3 -c "from urllib.parse import urlparse; r=urlparse('$DATABASE_URL'); print(r.username or '')" 2>/dev/null)
    DB_PASS_PARSED=$(python3 -c "from urllib.parse import urlparse; r=urlparse('$DATABASE_URL'); print(r.password or '')" 2>/dev/null)
    if [ -n "$DB_USER_PARSED" ]; then
        echo "   Ensuring database role '$DB_USER_PARSED' exists..."
        if [ -n "$DB_PASS_PARSED" ]; then
            psql "postgresql://@localhost:5432/postgres" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER_PARSED') THEN CREATE ROLE \"$DB_USER_PARSED\" WITH LOGIN PASSWORD '$DB_PASS_PARSED'; END IF; END \$\$;" 2>/dev/null || true
        else
            psql "postgresql://@localhost:5432/postgres" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER_PARSED') THEN CREATE ROLE \"$DB_USER_PARSED\" WITH LOGIN; END IF; END \$\$;" 2>/dev/null || true
        fi
    fi

    # Drop and recreate database
    echo "   Terminating active connections to database..."
    psql "postgresql://@localhost:5432/postgres" -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
    " 2>/dev/null || true
    
    echo "   Dropping existing database..."
    psql "postgresql://@localhost:5432/postgres" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    
    echo "   Creating new database..."
    if psql "postgresql://@localhost:5432/postgres" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null; then
        echo "   ✅ Database created successfully"
    else
        echo "   ⚠️  Database creation failed, probably already exists. Clearing existing tables..."
        # Drop all existing tables if database already exists
        psql "$DATABASE_URL" -c "
            DROP TABLE IF EXISTS pdi_images CASCADE;
            DROP TABLE IF EXISTS evrs CASCADE;
            DROP TABLE IF EXISTS motor_telemetry CASCADE;
            DROP TABLE IF EXISTS mobility_telemetry CASCADE;
            DROP TABLE IF EXISTS drive_telemetry CASCADE;
            DROP TABLE IF EXISTS sols CASCADE;
            DROP TABLE IF EXISTS drives CASCADE;  -- Legacy table
        " 2>/dev/null || true
    fi
    
    # Use the local admin connection (system superuser) to create extensions and apply schema.
    # The app role ($DB_USER_PARSED) lacks superuser privileges, so we apply as admin then grant access.
    ADMIN_DB_URL="postgresql://@localhost:5432/$DB_NAME"

    echo "   Enabling TimescaleDB extension..."
    psql "$ADMIN_DB_URL" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>/dev/null || true

    if [ -n "$DB_USER_PARSED" ]; then
        psql "$ADMIN_DB_URL" -c "GRANT ALL ON SCHEMA public TO \"$DB_USER_PARSED\";" 2>/dev/null || true
    fi

    echo "   Applying schema..."
    if ! psql -v ON_ERROR_STOP=1 "$ADMIN_DB_URL" -f database/schema.sql; then
        echo "❌ Schema application failed. Cannot continue."
        exit 1
    fi

    if [ -n "$DB_USER_PARSED" ]; then
        echo "   Granting table privileges to '$DB_USER_PARSED'..."
        psql "$ADMIN_DB_URL" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$DB_USER_PARSED\";" 2>/dev/null || true
        psql "$ADMIN_DB_URL" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER_PARSED\";" 2>/dev/null || true
    fi

    echo "✅ Database recreated successfully with PDI support"
    
    # Force data re-ingestion after database recreation
    FORCE_INGESTION=true
else
    FORCE_INGESTION=false
fi

# Check for data assets (map tiles and imagery)
echo ""
echo "🗺️  Checking data assets..."
MAP_TILES_DIR="$PLATFORM_DIR/backend/data/map_tiles"

if [ -d "$MAP_TILES_DIR" ] && [ "$(ls -A "$MAP_TILES_DIR" 2>/dev/null)" ]; then
    echo "✅ Data assets found"
else
    # Zenodo data bundle: map tiles, PDI, and VCE imagery (~2.4 GB)
    ZENODO_DATA_URL="https://zenodo.org/records/21094815/files/hindsight-data-release.tar.gz"

    echo "⚠️  Data bundle not found. Downloading from Zenodo (~2.4 GB)..."
    echo "   This may take several minutes depending on your connection."
    echo "   URL: $ZENODO_DATA_URL"
    echo ""

    BUNDLE_TMP="$PLATFORM_DIR/hindsight-data-release.tar.gz"

    if command -v curl &> /dev/null; then
        curl -L --progress-bar -o "$BUNDLE_TMP" "$ZENODO_DATA_URL"
    elif command -v wget &> /dev/null; then
        wget --show-progress -O "$BUNDLE_TMP" "$ZENODO_DATA_URL"
    else
        echo "❌ curl or wget is required to download the data bundle."
        echo "   Install one and re-run, or manually download and extract:"
        echo "   $ZENODO_DATA_URL"
        echo "   tar -xzf hindsight-data-release.tar.gz -C $PLATFORM_DIR"
        exit 1
    fi

    echo "   Extracting data bundle..."
    tar -xzf "$BUNDLE_TMP" -C "$PLATFORM_DIR"
    rm "$BUNDLE_TMP"
    echo "✅ Data assets ready"
fi

# Check if data exists and PDI/VCE images are processed
SOL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM sols;" | tr -d ' ')
PDI_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pdi_images;" | tr -d ' ')

# Check for existing PDI and VCE images
PDI_IMAGES_DIR="$PLATFORM_DIR/backend/data/pdi"
VCE_IMAGES_DIR="$PLATFORM_DIR/backend/data/vce"
PDI_FILES_COUNT=0
VCE_FILES_COUNT=0

if [ -d "$PDI_IMAGES_DIR" ]; then
    PDI_FILES_COUNT=$(find "$PDI_IMAGES_DIR" -name "*.png" | wc -l | tr -d ' ')
fi

if [ -d "$VCE_IMAGES_DIR" ]; then
    VCE_FILES_COUNT=$(find "$VCE_IMAGES_DIR" -name "*.png" | wc -l | tr -d ' ')
fi

if [ "$CLEAR_DATABASE" = true ] || [ "$FORCE_INGESTION" = true ]; then
    echo "⚠️  Running data ingestion due to database recreation or --clear flag..."
    NEED_INGESTION=true
elif [ "$SOL_COUNT" -gt "0" ] && [ "$PDI_COUNT" -gt "0" ] && [ "$PDI_FILES_COUNT" -gt "0" ]; then
    echo "✅ Data exists in database ($SOL_COUNT sols, $PDI_COUNT PDI records, $PDI_FILES_COUNT PDI files, $VCE_FILES_COUNT VCE files)"
    NEED_INGESTION=false
elif [ "$SOL_COUNT" -gt "0" ] && [ "$PDI_COUNT" -gt "0" ] && [ "$PDI_FILES_COUNT" -eq "0" ]; then
    echo "⚠️  PDI records exist but files are missing. Running ingestion to copy files..."
    NEED_INGESTION=true
elif [ "$SOL_COUNT" -gt "0" ] && [ "$PDI_COUNT" -eq "0" ]; then
    echo "⚠️  Sol data exists but PDI data missing. Running ingestion to add PDI support..."
    NEED_INGESTION=true
else
    echo "⚠️  No data in database. Running ingestion..."
    NEED_INGESTION=true
fi

# Run ingestion if needed
if [ "$NEED_INGESTION" = true ]; then
    echo ""
    echo "📥 Running data ingestion with PDI processing..."
    cd "$PLATFORM_DIR/ingestion"
    source venv/bin/activate
    
    # Check if source data files exist
    if [ ! -f "$REPO_ROOT/data/pds/best_interp.csv" ]; then
        echo "❌ Source data file not found: $REPO_ROOT/data/pds/best_interp.csv"
        echo "   Please ensure the data files are available"
        exit 1
    fi
    
    # Check if PDI source directories exist
    PDI_DIRS=(
        "$REPO_ROOT/data/unlimited_release_m20_data/datavis_fhaz_1040_1055"
        "$REPO_ROOT/data/unlimited_release_m20_data/datavis_rhaz_1040_1055"
        "$REPO_ROOT/data/unlimited_release_m20_data/datavis_ncam_1040_1055"
    )
    
    for pdi_dir in "${PDI_DIRS[@]}"; do
        if [ ! -d "$pdi_dir" ]; then
            echo "⚠️  PDI source directory not found: $pdi_dir"
            echo "   PDI images will not be processed for this camera type"
        fi
    done
    
    # Run ingestion with --clear flag if database was recreated or already has data
    if [ "$CLEAR_DATABASE" = true ] || [ "$FORCE_INGESTION" = true ] || [ "$SOL_COUNT" -gt "0" ]; then
        python ingest.py --clear
    else
        python ingest.py
    fi
    
    echo "✅ Data ingestion completed with PDI processing"
    
    # Verify PDI and VCE data was processed
    NEW_PDI_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pdi_images;" | tr -d ' ')
    PDI_IMAGES_DIR="$PLATFORM_DIR/backend/data/pdi"
    VCE_IMAGES_DIR="$PLATFORM_DIR/backend/data/vce"
    
    if [ "$NEW_PDI_COUNT" -gt "0" ]; then
        echo "✅ PDI data successfully processed ($NEW_PDI_COUNT records)"
        
        # Check if PDI images were actually copied
        if [ -d "$PDI_IMAGES_DIR" ]; then
            NEW_PDI_FILES_COUNT=$(find "$PDI_IMAGES_DIR" -name "*.png" | wc -l | tr -d ' ')
            if [ "$NEW_PDI_FILES_COUNT" -gt "0" ]; then
                if [ "$NEW_PDI_FILES_COUNT" -eq "$PDI_FILES_COUNT" ] && [ "$PDI_FILES_COUNT" -gt "0" ]; then
                    echo "✅ PDI images already present in backend directory ($PDI_FILES_COUNT files)"
                else
                    echo "✅ PDI images copied to backend directory ($NEW_PDI_FILES_COUNT files)"
                fi
            else
                echo "⚠️  PDI database records exist but no image files found in $PDI_IMAGES_DIR"
            fi
        else
            echo "⚠️  PDI images directory not found: $PDI_IMAGES_DIR"
        fi
        
        # Check if VCE images were copied
        if [ -d "$VCE_IMAGES_DIR" ]; then
            NEW_VCE_FILES_COUNT=$(find "$VCE_IMAGES_DIR" -name "*.png" | wc -l | tr -d ' ')
            if [ "$NEW_VCE_FILES_COUNT" -gt "0" ]; then
                if [ "$NEW_VCE_FILES_COUNT" -eq "$VCE_FILES_COUNT" ] && [ "$VCE_FILES_COUNT" -gt "0" ]; then
                    echo "✅ VCE images already present in backend directory ($VCE_FILES_COUNT files)"
                else
                    echo "✅ VCE images copied to backend directory ($NEW_VCE_FILES_COUNT files)"
                fi
            else
                echo "⚠️  VCE database records exist but no image files found in $VCE_IMAGES_DIR"
            fi
        else
            echo "⚠️  VCE images directory not found: $VCE_IMAGES_DIR"
        fi
    else
        echo "⚠️  No PDI/VCE data was processed (check source directories)"
    fi
fi

# Ensure PDI directory exists and is accessible
echo ""
echo "📷 Verifying PDI directory setup..."
PDI_BACKEND_DIR="$PLATFORM_DIR/backend/data/pdi"

if [ ! -d "$PDI_BACKEND_DIR" ]; then
    echo "   Creating PDI directory: $PDI_BACKEND_DIR"
    mkdir -p "$PDI_BACKEND_DIR"
fi

# Create README if it doesn't exist
if [ ! -f "$PDI_BACKEND_DIR/README.md" ]; then
    echo "   Creating PDI README file..."
    cat > "$PDI_BACKEND_DIR/README.md" << 'EOF'
# Post Drive Imagery (PDI) Directory

This directory contains Post Drive Imagery files copied from the Mars 2020 data set during
the data ingestion process. Images are accessible via the backend API at `/images/pdi/{filename}`.

Images are automatically copied during data ingestion (`ingest.py`). Only the selected "best"
images for each sol are copied to save space; original images remain in the source data directories.
EOF
fi

# Check directory permissions
if [ -w "$PDI_BACKEND_DIR" ]; then
    echo "✅ PDI directory is writable: $PDI_BACKEND_DIR"
else
    echo "⚠️  PDI directory permissions issue: $PDI_BACKEND_DIR"
fi

# Ensure VCE directory exists and is accessible
echo ""
echo "🎥 Verifying VCE directory setup..."
VCE_BACKEND_DIR="$PLATFORM_DIR/backend/data/vce"

if [ ! -d "$VCE_BACKEND_DIR" ]; then
    echo "   Creating VCE directory: $VCE_BACKEND_DIR"
    mkdir -p "$VCE_BACKEND_DIR"
fi

# Create README if it doesn't exist
if [ ! -f "$VCE_BACKEND_DIR/README.md" ]; then
    echo "   Creating VCE README file..."
    cat > "$VCE_BACKEND_DIR/README.md" << 'EOF'
# Visual Context Event (VCE) Directory

This directory contains Visual Context Event image files copied from the Mars 2020 data set during
the data ingestion process. Images are accessible via the backend API at `/images/vce/{filename}`.

Images are automatically copied during data ingestion (`ingest.py`). Only the selected "best"
images for each sol are copied to save space; original images remain in the source data directories.
EOF
fi

# Check directory permissions
if [ -w "$VCE_BACKEND_DIR" ]; then
    echo "✅ VCE directory is writable: $VCE_BACKEND_DIR"
else
    echo "⚠️  VCE directory permissions issue: $VCE_BACKEND_DIR"
fi

# Start backend server in background for testing
echo ""
echo "🚀 Starting backend server for testing..."
cd "$PLATFORM_DIR/backend"
source venv/bin/activate

# Kill any existing server
pkill -f "python main.py" || true
pkill -f "uvicorn main:app" || true

# Start server in background
python main.py &
SERVER_PID=$!
echo "   Server started (PID: $SERVER_PID)"

# Wait for server to start
echo "   Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s "http://127.0.0.1:8000/health" &> /dev/null; then
        echo "✅ Server is ready"
        break
    fi
    sleep 1
done

# Run system tests
echo ""
echo "🧪 Running system tests..."
cd "$PLATFORM_DIR"

# Install test dependencies
pip install -q requests python-dotenv sqlalchemy

python test_system.py
TEST_RESULT=$?

# Clean up background server
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID || true

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "🎉 Quick start completed successfully!"
    echo ""
    echo "Setup complete. To run Hindsight:"
    echo ""
    echo "1. Start the backend:"
    echo "   cd backend && source venv/bin/activate && python main.py"
    echo ""
    echo "2. In a new terminal, start the frontend:"
    echo "   cd frontend && npm install && npm run dev"
    echo ""
    echo "Hindsight will be available at: http://localhost:5173"
    
    exit 0
else
    echo ""
    echo "❌ Quick start encountered issues. Please check the test output above."
    exit 1
fi 