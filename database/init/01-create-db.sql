-- Database initialization script
-- This script runs before the main schema to ensure the database is properly set up

-- Create the database user if it doesn't exist
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'hindsight') THEN

      -- Password is a dev default; set DB_PASSWORD in .env for production
      CREATE ROLE hindsight LOGIN PASSWORD 'hindsight_dev_password';
   END IF;
END
$do$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE drive_analysis TO hindsight;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable additional useful extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For trigram text search

-- Log successful initialization
SELECT 'Database initialization completed successfully' AS status;