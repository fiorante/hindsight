#!/bin/bash

# Hindsight Docker Startup Script
# This script provides convenient commands for managing the Dockerized Hindsight platform

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Database helper functions
check_database_ready() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if $COMPOSE_CMD $COMPOSE_FILES exec -T database pg_isready -U hindsight -d drive_analysis >/dev/null 2>&1; then
            return 0
        fi
        log_info "Waiting for database to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "Database failed to start within $max_attempts attempts"
    return 1
}

check_database_has_data() {
    local result
    result=$($COMPOSE_CMD $COMPOSE_FILES exec -T database psql -U hindsight -d drive_analysis -c "SELECT COUNT(*) FROM sols;" 2>/dev/null | grep -E "^\s*[0-9]+" | tr -d ' ')
    
    if [ "$result" = "0" ] || [ -z "$result" ]; then
        return 0  # Database is empty or query failed
    else
        return 1  # Database has data
    fi
}

# Setup volume permissions for cross-platform compatibility
setup_volume_permissions() {
    log_info "Setting up backend_data volume permissions..."
    
    # Create volume if it doesn't exist
    docker volume create hindsight_backend_data 2>/dev/null || true
    
    # Set up volume structure with proper permissions
    docker run --rm -v platform_backend_data:/data alpine:latest sh -c "
        # Create directories
        mkdir -p /data/pdi /data/vce /data/map_tiles /data/rover_path
        
        # Set permissions to be writable by any user (cross-platform compatibility)
        chmod -R 777 /data
        
        # Try to set ownership to common container user IDs
        chown -R 1000:1000 /data 2>/dev/null || true
        chown -R 999:999 /data 2>/dev/null || true
        
        echo '✅ Volume permissions set for cross-platform compatibility'
    "
    
    log_success "Volume permissions configured!"
}

# Help function
show_help() {
    cat << EOF
🚀 Hindsight Docker Management Script

Usage: $0 [COMMAND] [OPTIONS]

COMMANDS:
    start           Start all services with automatic data ingestion if needed
    stop            Stop all services
    restart         Restart all services
    build           Build all Docker images
    logs [SERVICE]  Show logs for all services or specific service
    shell [SERVICE] Open a shell in a running container
    ingest          Run data ingestion (manual)
    force-ingest    Force data ingestion even if data exists
    reset           Reset database and re-run ingestion
    status          Show status of all services
    help            Show this help message

SERVICES:
    database        PostgreSQL with TimescaleDB
    backend         FastAPI backend service
    frontend        React frontend service
    ingestion       Data ingestion service
    nginx           Nginx reverse proxy (production only)

OPTIONS:
    --prod          Use production configuration
    --dev           Use development configuration (default)
    --build         Force rebuild images before starting

EXAMPLES:
    $0 start                    # Start all services in development mode
    $0 start --prod             # Start all services in production mode
    $0 logs backend             # Show backend logs
    $0 shell backend            # Open shell in backend container
    $0 ingest                   # Run data ingestion
    $0 reset                    # Reset database and re-ingest data

EOF
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
}

# Get docker-compose command
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# Parse command line arguments
PRODUCTION=false
DEVELOPMENT=true
FORCE_BUILD=false
COMPOSE_FILES="-f docker-compose.yml"

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            PRODUCTION=true
            DEVELOPMENT=false
            COMPOSE_FILES="-f docker-compose.yml --profile production"
            shift
            ;;
        --dev|--development)
            DEVELOPMENT=true
            PRODUCTION=false
            COMPOSE_FILES="-f docker-compose.yml"
            shift
            ;;
        --build)
            FORCE_BUILD=true
            shift
            ;;
        *)
            break
            ;;
    esac
done

COMMAND="${1:-help}"
SERVICE="${2:-}"

COMPOSE_CMD=$(get_compose_cmd)

# Change to platform directory
cd "$SCRIPT_DIR"

# Main command handling
case $COMMAND in
    start)
        log_info "Starting Hindsight platform..."
        check_docker
        
        if [ "$FORCE_BUILD" = true ]; then
            log_info "Building Docker images..."
            $COMPOSE_CMD $COMPOSE_FILES build
        fi
        
        # Start database first
        log_info "Starting database..."
        $COMPOSE_CMD $COMPOSE_FILES up -d database
        
        # Set up volume permissions for cross-platform compatibility
        log_info "Setting up volume permissions..."
        setup_volume_permissions
        
        # Wait for database to be ready
        log_info "Waiting for database to be ready..."
        if ! check_database_ready; then
            log_error "Failed to start database. Exiting."
            exit 1
        fi
        log_success "Database is ready!"
        
        # Check if database has data
        log_info "Checking if database needs data ingestion..."
        if check_database_has_data; then
            log_info "Database is empty. Running data ingestion..."
            $COMPOSE_CMD $COMPOSE_FILES --profile ingestion run --rm ingestion
            if [ $? -eq 0 ]; then
                log_success "Data ingestion completed!"
            else
                log_error "Data ingestion failed!"
                exit 1
            fi
        else
            log_info "Database already contains data. Skipping ingestion."
        fi
        
        # Start remaining services
        if [ "$PRODUCTION" = true ]; then
            log_info "Starting in production mode..."
            $COMPOSE_CMD $COMPOSE_FILES up -d backend frontend nginx
        else
            log_info "Starting in development mode..."
            $COMPOSE_CMD $COMPOSE_FILES up -d backend frontend
        fi
        
        log_success "Services started successfully!"
        log_info "Frontend: http://localhost:5173"
        log_info "Backend API: http://localhost:8000"
        log_info "API Docs: http://localhost:8000/docs"
        
        if [ "$PRODUCTION" = true ]; then
            log_info "Production site: http://localhost"
        fi
        ;;
        
    stop)
        log_info "Stopping Hindsight platform..."
        check_docker
        $COMPOSE_CMD $COMPOSE_FILES down
        log_success "Services stopped successfully!"
        ;;
        
    restart)
        log_info "Restarting Hindsight platform..."
        check_docker
        $COMPOSE_CMD $COMPOSE_FILES restart
        log_success "Services restarted successfully!"
        ;;
        
    build)
        log_info "Building Docker images..."
        check_docker
        $COMPOSE_CMD $COMPOSE_FILES build
        log_success "Images built successfully!"
        ;;
        
    logs)
        check_docker
        if [ -z "$SERVICE" ]; then
            log_info "Showing logs for all services..."
            $COMPOSE_CMD $COMPOSE_FILES logs -f
        else
            log_info "Showing logs for $SERVICE..."
            $COMPOSE_CMD $COMPOSE_FILES logs -f "$SERVICE"
        fi
        ;;
        
    shell)
        check_docker
        if [ -z "$SERVICE" ]; then
            SERVICE="backend"
        fi
        log_info "Opening shell in $SERVICE container..."
        $COMPOSE_CMD $COMPOSE_FILES exec "$SERVICE" /bin/bash || \
        $COMPOSE_CMD $COMPOSE_FILES exec "$SERVICE" /bin/sh
        ;;
        
    ingest)
        log_info "Running data ingestion..."
        check_docker
        $COMPOSE_CMD $COMPOSE_FILES --profile ingestion run --rm ingestion
        if [ $? -eq 0 ]; then
            log_success "Data ingestion completed!"
        else
            log_error "Data ingestion failed!"
            exit 1
        fi
        ;;
        
    force-ingest)
        log_warning "Force running data ingestion (will overwrite existing data)..."
        check_docker
        $COMPOSE_CMD $COMPOSE_FILES --profile ingestion run --rm ingestion
        if [ $? -eq 0 ]; then
            log_success "Data ingestion completed!"
        else
            log_error "Data ingestion failed!"
            exit 1
        fi
        ;;
        
    reset)
        log_warning "This will reset the database and re-ingest all data!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping services..."
            $COMPOSE_CMD $COMPOSE_FILES down
            
            log_info "Removing volumes..."
            docker volume rm hindsight_database_data 2>/dev/null || true
            docker volume rm hindsight_backend_data 2>/dev/null || true
            
            log_info "Starting database..."
            $COMPOSE_CMD $COMPOSE_FILES up -d database
            
            log_info "Setting up volume permissions..."
            setup_volume_permissions
            
            log_info "Waiting for database to be ready..."
            if ! check_database_ready; then
                log_error "Failed to start database. Exiting."
                exit 1
            fi
            
            log_info "Running data ingestion..."
            $COMPOSE_CMD $COMPOSE_FILES --profile ingestion run --rm ingestion
            
            log_info "Starting all services..."
            $COMPOSE_CMD $COMPOSE_FILES up -d backend frontend
            
            log_success "Database reset and data ingestion completed!"
        else
            log_info "Reset cancelled."
        fi
        ;;
        
    status)
        check_docker
        log_info "Service status:"
        $COMPOSE_CMD $COMPOSE_FILES ps
        ;;
        
    help|--help|-h)
        show_help
        ;;
        
    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
