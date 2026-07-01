-- Hindsight Database Schema

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Telemetry data (no longer tied to specific drives/sols)
-- This table stores all rover telemetry data with SCLK as the primary time reference
CREATE TABLE drive_telemetry (
    sclk BIGINT NOT NULL PRIMARY KEY,
    easting DOUBLE PRECISION,
    northing DOUBLE PRECISION,
    elevation DOUBLE PRECISION,
    slope DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    velocity DOUBLE PRECISION,
    terrain VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert drive_telemetry to a TimescaleDB hypertable for better time-series performance
SELECT create_hypertable('drive_telemetry', 'sclk', chunk_time_interval => 86400000000::bigint);

-- Slip telemetry (unitless) parsed from EVRs, independent timeline
CREATE TABLE IF NOT EXISTS slip_telemetry (
    sclk BIGINT NOT NULL PRIMARY KEY,
    slip DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);

SELECT create_hypertable('slip_telemetry', 'sclk', chunk_time_interval => 86400000000::bigint, if_not_exists => TRUE);

-- EVR data (no longer tied to specific drives/sols)
-- This table stores event records with SCLK as the primary time reference
CREATE TABLE evrs (
    log_num INTEGER NOT NULL,
    sclk BIGINT NOT NULL,
    module VARCHAR(100),
    message TEXT NOT NULL,
    name VARCHAR(200),
    event_id BIGINT,
    level VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY(sclk, log_num) -- Composite primary key including sclk
);

-- Convert evrs to a TimescaleDB hypertable for better time-series performance
SELECT create_hypertable('evrs', 'sclk', chunk_time_interval => 86400000000::bigint);

-- Sol metadata (replaces drives table)
-- This table stores metadata about each sol, including SCLK boundaries
CREATE TABLE sols (
    sol INTEGER PRIMARY KEY,
    start_sclk BIGINT NOT NULL,
    end_sclk BIGINT NOT NULL,
    distance DOUBLE PRECISION,
    duration DOUBLE PRECISION,
    point_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Mobility system telemetry data
-- This table stores detailed mobility system telemetry (SYS_MOB data)
CREATE TABLE mobility_telemetry (
    sclk BIGINT NOT NULL PRIMARY KEY,
    bogie_l DOUBLE PRECISION,
    bogie_r DOUBLE PRECISION,
    diff_l DOUBLE PRECISION,
    diff_r DOUBLE PRECISION,
    accel_x DOUBLE PRECISION,
    pos_y DOUBLE PRECISION,
    pos_x DOUBLE PRECISION,
    accel_y DOUBLE PRECISION,
    accel_z DOUBLE PRECISION,
    pitch DOUBLE PRECISION,
    pos_z DOUBLE PRECISION,
    accel_pitch DOUBLE PRECISION,
    roll DOUBLE PRECISION,
    yaw DOUBLE PRECISION,
    tilt DOUBLE PRECISION,
    accel_tilt DOUBLE PRECISION,
    accel_roll DOUBLE PRECISION,
    elapsed_time DOUBLE PRECISION,
    pos_x_x DOUBLE PRECISION,
    raw_accel_z DOUBLE PRECISION,
    raw_accel_x DOUBLE PRECISION,
    raw_accel_y DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Convert mobility_telemetry to a TimescaleDB hypertable
SELECT create_hypertable('mobility_telemetry', 'sclk', chunk_time_interval => 86400000000::bigint);

-- Motor telemetry data
-- This table stores drive and steer motor telemetry for each individual motor
CREATE TABLE motor_telemetry (
    sclk BIGINT NOT NULL,
    motor_name VARCHAR(20) NOT NULL,
    odom DOUBLE PRECISION,
    angle DOUBLE PRECISION,
    voltage DOUBLE PRECISION,
    field DOUBLE PRECISION,
    state DOUBLE PRECISION,
    cbrake_ma DOUBLE PRECISION,
    cmotor DOUBLE PRECISION,
    cstatus DOUBLE PRECISION,
    cbrake_status DOUBLE PRECISION,
    tprt1 DOUBLE PRECISION,
    angular_rate DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY(sclk, motor_name) -- Composite primary key including motor name
);

-- Convert motor_telemetry to a TimescaleDB hypertable
SELECT create_hypertable('motor_telemetry', 'sclk', chunk_time_interval => 86400000000::bigint);

-- Post Drive Imagery (PDI) data
-- This table stores metadata for camera images taken after each drive
CREATE TABLE pdi_images (
    sol INTEGER PRIMARY KEY REFERENCES sols(sol) ON DELETE CASCADE,
    fhaz_left_filename VARCHAR(255),
    fhaz_left_sclk BIGINT,
    fhaz_right_filename VARCHAR(255),
    fhaz_right_sclk BIGINT,
    rhaz_left_filename VARCHAR(255),
    rhaz_left_sclk BIGINT,
    rhaz_right_filename VARCHAR(255),
    rhaz_right_sclk BIGINT,
    ncam_left_filename VARCHAR(255),
    ncam_left_sclk BIGINT,
    ncam_right_filename VARCHAR(255),
    ncam_right_sclk BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Visual Compute Element (VCE) imagery data
-- This table stores metadata for VCE stereo pairs taken during drives
CREATE TABLE vce_images (
    id SERIAL PRIMARY KEY,
    sol INTEGER NOT NULL REFERENCES sols(sol) ON DELETE CASCADE,
    sclk BIGINT NOT NULL,
    left_filename VARCHAR(255),
    right_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(sol, sclk) -- Ensure unique combinations of sol and sclk
);

-- Faults data
-- This table stores mobility faults extracted from EVR records
CREATE TABLE faults (
    id SERIAL PRIMARY KEY,
    sol INTEGER NOT NULL REFERENCES sols(sol) ON DELETE CASCADE,
    sclk BIGINT NOT NULL,
    fault_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(sol, sclk, fault_type) -- Ensure unique combinations
);

-- Indexes for performance
CREATE INDEX idx_telemetry_sclk ON drive_telemetry(sclk);
CREATE INDEX IF NOT EXISTS idx_slip_sclk ON slip_telemetry(sclk);
CREATE INDEX idx_telemetry_coordinates ON drive_telemetry(easting, northing);
-- Enable trigram for fast substring search on message
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_evrs_sclk ON evrs(sclk);
CREATE INDEX idx_evrs_sclk_log ON evrs(sclk, log_num);
CREATE INDEX idx_evrs_level ON evrs(level);
CREATE INDEX idx_evrs_module ON evrs(module);
CREATE INDEX idx_evrs_name ON evrs(name);
CREATE INDEX idx_evrs_message_trgm ON evrs USING gin (message gin_trgm_ops);
CREATE INDEX idx_sols_sclk_range ON sols(start_sclk, end_sclk);
CREATE INDEX idx_mobility_telemetry_sclk ON mobility_telemetry(sclk);
CREATE INDEX idx_motor_telemetry_sclk ON motor_telemetry(sclk);
CREATE INDEX idx_motor_telemetry_motor_name ON motor_telemetry(motor_name);
CREATE INDEX idx_vce_images_sol ON vce_images(sol);
CREATE INDEX idx_vce_images_sclk ON vce_images(sclk);
CREATE INDEX idx_faults_sol ON faults(sol);
CREATE INDEX idx_faults_sclk ON faults(sclk);
CREATE INDEX idx_faults_type ON faults(fault_type);

-- Comments for documentation
COMMENT ON TABLE drive_telemetry IS 'Rover telemetry data indexed by sclk timestamp';
COMMENT ON TABLE evrs IS 'Event records indexed by sclk timestamp';
COMMENT ON TABLE sols IS 'Sol metadata with sclk boundaries for sol-based queries';
COMMENT ON TABLE mobility_telemetry IS 'Detailed mobility system telemetry (SYS_MOB) indexed by sclk timestamp';
COMMENT ON TABLE motor_telemetry IS 'Individual motor telemetry for drive and steer motors indexed by sclk timestamp';
COMMENT ON TABLE pdi_images IS 'Post Drive Imagery metadata for camera images taken after each drive';
COMMENT ON TABLE vce_images IS 'Visual Compute Element stereo pairs taken during drives';
COMMENT ON COLUMN drive_telemetry.sclk IS 'sclk timestamp (primary time reference)';
COMMENT ON TABLE slip_telemetry IS 'Visual Odometry slip (unitless) parsed from EVRs per SCLK';
COMMENT ON COLUMN evrs.sclk IS 'sclk timestamp (primary time reference)';
COMMENT ON COLUMN sols.start_sclk IS 'sclk timestamp of first telemetry point in sol';
COMMENT ON COLUMN sols.end_sclk IS 'sclk timestamp of last telemetry point in sol';
COMMENT ON COLUMN mobility_telemetry.sclk IS 'sclk timestamp (primary time reference)';
COMMENT ON COLUMN motor_telemetry.sclk IS 'sclk timestamp (primary time reference)';
COMMENT ON COLUMN motor_telemetry.motor_name IS 'Motor identifier (e.g., DRIVE_LF, STEER_RF, etc.)';
COMMENT ON COLUMN pdi_images.sol IS 'Sol number (primary key and foreign key to sols table)';
COMMENT ON COLUMN pdi_images.fhaz_left_filename IS 'Front Hazcam left image filename (if available)';
COMMENT ON COLUMN pdi_images.fhaz_right_filename IS 'Front Hazcam right image filename (if available)';
COMMENT ON COLUMN pdi_images.rhaz_left_filename IS 'Rear Hazcam left image filename (if available)';
COMMENT ON COLUMN pdi_images.rhaz_right_filename IS 'Rear Hazcam right image filename (if available)';
COMMENT ON COLUMN pdi_images.ncam_left_filename IS 'Navcam left image filename (if available)';
COMMENT ON COLUMN pdi_images.ncam_right_filename IS 'Navcam right image filename (if available)'; 
COMMENT ON TABLE faults IS 'Mobility faults extracted from EVR records during drives';
COMMENT ON COLUMN faults.sol IS 'Sol number (foreign key to sols table)';
COMMENT ON COLUMN faults.sclk IS 'sclk timestamp when fault occurred';
COMMENT ON COLUMN faults.fault_type IS 'Type of mobility fault (e.g., CUTOFF_TIME, STOP_MOM, etc.)'; 