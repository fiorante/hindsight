# Dockerfile for data ingestion service
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . ./src/

# Create data directories and set permissions
RUN mkdir -p /app/data /app/writable && \
    chown -R appuser:appuser /app

# Set Python path to include shared modules
ENV PYTHONPATH="/app/src:/app/shared"

# Create a startup script to handle permissions
RUN echo '#!/bin/bash\n\
# Ensure writable directory has correct permissions\n\
if [ -d "/app/writable" ]; then\n\
    chown -R appuser:appuser /app/writable\n\
    chmod -R 777 /app/writable\n\
fi\n\
\n\
# Create directories if they don'\''t exist\n\
mkdir -p /app/writable/pdi /app/writable/vce\n\
chown -R appuser:appuser /app/writable\n\
chmod -R 777 /app/writable\n\
\n\
# Switch to non-root user and run the command\n\
exec gosu appuser "$@"' > /app/start.sh && \
    chmod +x /app/start.sh

# Install gosu for proper user switching
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Default command (can be overridden)
CMD ["/app/start.sh", "python", "src/ingest.py"]
