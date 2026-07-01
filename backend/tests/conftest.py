"""
Pytest configuration and fixtures for backend testing.
"""

import pytest
import pandas as pd
from unittest.mock import Mock, MagicMock
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from main import app
from database.connection import get_db
from models import (
    SolListItem, TelemetryPoint, EVRRecord, FaultRecord,
    MobilityTelemetryPoint, MotorTelemetryPoint
)


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_db_session():
    """Mock database session for testing."""
    return Mock(spec=Session)


@pytest.fixture
def sample_sol_data():
    """Sample sol data for testing."""
    return {
        'sol': 1041,
        'distance': 15.5,
        'start_sclk': 759350569,
        'end_sclk': 759359342,
        'duration': 8773.0,
        'point_count': 242
    }


@pytest.fixture
def sample_telemetry_data():
    """Sample telemetry data for testing."""
    return pd.DataFrame({
        'sclk': [759350569, 759350570, 759350571],
        'easting': [123456.0, 123457.0, 123458.0],
        'northing': [987654.0, 987655.0, 987656.0],
        'elevation': [-100.5, -100.6, -100.7],
        'slope': [2.1, 2.2, 2.3],
        'heading': [45.0, 45.1, 45.2],
        'velocity': [0.5, 0.6, 0.7],
        'terrain': ['bedrock', 'bedrock', 'sand']
    })


@pytest.fixture
def sample_evr_data():
    """Sample EVR data for testing."""
    return pd.DataFrame({
        'log_num': [24940, 24941, 24942],
        'sclk': [759350569, 759350570, 759350571],
        'module': ['DRIVE', 'DRIVE', 'DRIVE'],
        'message': ['Drive started', 'Drive in progress', 'Drive completed'],
        'name': ['DRIVE_START', 'DRIVE_PROGRESS', 'DRIVE_END'],
        'event_id': [1001, 1002, 1003],
        'level': ['INFO', 'INFO', 'INFO']
    })


@pytest.fixture
def sample_fault_data():
    """Sample fault data for testing."""
    return pd.DataFrame({
        'sclk': [759350569, 759350570],
        'fault_type': ['WHEEL_SLIP', 'TERRAIN_HAZARD']
    })


@pytest.fixture
def sample_mobility_telemetry_data():
    """Sample mobility telemetry data for testing."""
    return pd.DataFrame({
        'sclk': [759350569, 759350570],
        'accel_x': [0.1, 0.2],
        'accel_y': [0.3, 0.4],
        'accel_z': [0.5, 0.6],
        'pitch': [1.0, 1.1],
        'roll': [2.0, 2.1],
        'yaw': [3.0, 3.1],
        'tilt': [4.0, 4.1],
        'bogie_l': [5.0, 5.1],
        'bogie_r': [6.0, 6.1],
        'diff_l': [7.0, 7.1],
        'diff_r': [8.0, 8.1],
        'pos_x': [9.0, 9.1],
        'pos_y': [10.0, 10.1],
        'pos_z': [11.0, 11.1],
        'elapsed_time': [12.0, 12.1],
        'raw_accel_x': [13.0, 13.1],
        'raw_accel_y': [14.0, 14.1],
        'raw_accel_z': [15.0, 15.1],
        'accel_pitch': [16.0, 16.1],
        'accel_roll': [17.0, 17.1],
        'accel_tilt': [18.0, 18.1]
    })


@pytest.fixture
def sample_motor_telemetry_data():
    """Sample motor telemetry data for testing."""
    return pd.DataFrame({
        'sclk': [759350569, 759350570],
        'motor_name': ['DRIVE_LF', 'DRIVE_LF'],
        'odom': [100.0, 101.0],
        'angle': [45.0, 46.0],
        'voltage': [12.0, 12.1],
        'field': [1.0, 1.1],
        'state': [1, 1],
        'cbrake_ma': [0.0, 0.0],
        'cmotor': [2.0, 2.1],
        'cstatus': [1, 1],
        'cbrake_status': [0, 0],
        'tprt1': [25.0, 25.1],
        'angular_rate': [0.5, 0.6]
    })


@pytest.fixture
def sample_sol_list():
    """Sample sol list for testing."""
    return [
        SolListItem(
            sol=1041,
            distance=15.5,
            start_sclk=759350569,
            end_sclk=759359342,
            duration=8773.0,
            point_count=242
        ),
        SolListItem(
            sol=1042,
            distance=12.3,
            start_sclk=759359343,
            end_sclk=759368000,
            duration=8657.0,
            point_count=198
        )
    ]


@pytest.fixture
def sample_telemetry_points():
    """Sample telemetry points for testing."""
    return [
        TelemetryPoint(
            sclk=759350569,
            easting=123456.0,
            northing=987654.0,
            elevation=-100.5,
            slope=2.1,
            heading=45.0,
            velocity=0.5,
            terrain='bedrock'
        ),
        TelemetryPoint(
            sclk=759350570,
            easting=123457.0,
            northing=987655.0,
            elevation=-100.6,
            slope=2.2,
            heading=45.1,
            velocity=0.6,
            terrain='bedrock'
        )
    ]


@pytest.fixture
def sample_evr_records():
    """Sample EVR records for testing."""
    return [
        EVRRecord(
            log_num=24940,
            sclk=759350569,
            module='DRIVE',
            message='Drive started',
            name='DRIVE_START',
            event_id=1001,
            level='INFO'
        ),
        EVRRecord(
            log_num=24941,
            sclk=759350570,
            module='DRIVE',
            message='Drive in progress',
            name='DRIVE_PROGRESS',
            event_id=1002,
            level='INFO'
        )
    ]


@pytest.fixture
def sample_fault_records():
    """Sample fault records for testing."""
    return [
        FaultRecord(
            sclk=759350569,
            fault_type='WHEEL_SLIP'
        ),
        FaultRecord(
            sclk=759350570,
            fault_type='TERRAIN_HAZARD'
        )
    ]


@pytest.fixture
def sample_mobility_telemetry_points():
    """Sample mobility telemetry points for testing."""
    return [
        MobilityTelemetryPoint(
            sclk=759350569,
            accel_x=0.1,
            accel_y=0.3,
            accel_z=0.5,
            pitch=1.0,
            roll=2.0,
            yaw=3.0,
            tilt=4.0,
            bogie_l=5.0,
            bogie_r=6.0,
            diff_l=7.0,
            diff_r=8.0,
            pos_x=9.0,
            pos_y=10.0,
            pos_z=11.0,
            elapsed_time=12.0,
            raw_accel_x=13.0,
            raw_accel_y=14.0,
            raw_accel_z=15.0,
            accel_pitch=16.0,
            accel_roll=17.0,
            accel_tilt=18.0
        ),
        MobilityTelemetryPoint(
            sclk=759350570,
            accel_x=0.2,
            accel_y=0.4,
            accel_z=0.6,
            pitch=1.1,
            roll=2.1,
            yaw=3.1,
            tilt=4.1,
            bogie_l=5.1,
            bogie_r=6.1,
            diff_l=7.1,
            diff_r=8.1,
            pos_x=9.1,
            pos_y=10.1,
            pos_z=11.1,
            elapsed_time=12.1,
            raw_accel_x=13.1,
            raw_accel_y=14.1,
            raw_accel_z=15.1,
            accel_pitch=16.1,
            accel_roll=17.1,
            accel_tilt=18.1
        )
    ]


@pytest.fixture
def sample_motor_telemetry_points():
    """Sample motor telemetry points for testing."""
    return [
        MotorTelemetryPoint(
            sclk=759350569,
            motor_name='DRIVE_LF',
            odom=100.0,
            angle=45.0,
            voltage=12.0,
            field=1.0,
            state=1,
            cbrake_ma=0.0,
            cmotor=2.0,
            cstatus=1,
            cbrake_status=0,
            tprt1=25.0,
            angular_rate=0.5
        ),
        MotorTelemetryPoint(
            sclk=759350570,
            motor_name='DRIVE_LF',
            odom=101.0,
            angle=46.0,
            voltage=12.1,
            field=1.1,
            state=1,
            cbrake_ma=0.0,
            cmotor=2.1,
            cstatus=1,
            cbrake_status=0,
            tprt1=25.1,
            angular_rate=0.6
        )
    ]


# Override the database dependency for testing
def override_get_db():
    """Override database dependency for testing."""
    try:
        db = Mock(spec=Session)
        yield db
    finally:
        pass


# Apply the override
app.dependency_overrides[get_db] = override_get_db
