"""
Tests for the service layer.
"""

import pytest
import pandas as pd
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException

from services.sol_service import SolService
from services.telemetry_service import TelemetryService
from services.similarity_service import SimilarityService
from services.fault_service import FaultService
from services.evr_service import EVRService
from services.map_service import MapService
from services.search_service import SearchService
from services.image_service import ImageService
from models import (
    SolData, SolListItem, MobilityTelemetryResponse, MotorTelemetryResponse,
    MotorListResponse, ChartDataResponse, NearestSCLKResponse, SegmentValidationResponse
)


class TestSolService:
    """Tests for SolService."""
    
    def test_get_sols_list_success(self, mock_db_session, sample_sol_list):
        """Test successful retrieval of sols list."""
        # Arrange
        service = SolService(mock_db_session)
        
        # Act
        with patch.object(service.sol_repo, 'get_all_sols', return_value=sample_sol_list):
            result = service.get_sols_list()
        
        # Assert
        assert len(result) == 2
        assert result[0].sol == 1041
        assert result[0].distance == 15.5
        assert result[1].sol == 1042
        assert result[1].distance == 12.3
    
    def test_get_sol_data_success(self, mock_db_session, sample_sol_data, sample_telemetry_data, sample_evr_data):
        """Test successful retrieval of complete sol data."""
        # Arrange
        service = SolService(mock_db_session)
        mock_sol_metadata = pd.Series(sample_sol_data)
        
        # Act
        with patch.object(service.sol_repo, 'get_sol_metadata', return_value=mock_sol_metadata), \
             patch.object(service.telemetry_repo, 'get_drive_telemetry', return_value=sample_telemetry_data), \
             patch.object(service.evr_repo, 'get_evrs_for_sclk_range', return_value=sample_evr_data), \
             patch.object(service, '_convert_telemetry_to_points', return_value=[]), \
             patch.object(service, '_convert_evrs_to_records', return_value=[]), \
             patch('services.sol_service.ImageService') as mock_image_service:
            
            mock_image_service.return_value.get_sol_pdi.return_value = None
            result = service.get_sol_data(1041)
        
        # Assert
        assert result is not None
        assert result.sol == 1041
        assert result.distance == 15.5
        assert result.start_sclk == 759350569
        assert result.end_sclk == 759359342
        assert result.duration == 8773.0
        assert result.point_count == 242
    
    def test_get_sol_data_not_found(self, mock_db_session):
        """Test retrieval of non-existent sol data."""
        # Arrange
        service = SolService(mock_db_session)
        
        # Act
        with patch.object(service.sol_repo, 'get_sol_metadata', return_value=None):
            result = service.get_sol_data(9999)
        
        # Assert
        assert result is None
    
    def test_convert_telemetry_to_points(self, mock_db_session, sample_telemetry_data):
        """Test conversion of telemetry DataFrame to TelemetryPoint objects."""
        # Arrange
        service = SolService(mock_db_session)
        
        # Act
        result = service._convert_telemetry_to_points(sample_telemetry_data)
        
        # Assert
        assert len(result) == 3
        assert result[0].sclk == 759350569
        assert result[0].easting == 123456.0
        assert result[0].northing == 987654.0
        assert result[0].elevation == -100.5
        assert result[0].slope == 2.1
        assert result[0].heading == 45.0
        assert result[0].velocity == 0.5
        assert result[0].terrain == 'bedrock'
    
    def test_convert_evrs_to_records(self, mock_db_session, sample_evr_data):
        """Test conversion of EVR DataFrame to EVRRecord objects."""
        # Arrange
        service = SolService(mock_db_session)
        
        # Act
        result = service._convert_evrs_to_records(sample_evr_data)
        
        # Assert
        assert len(result) == 3
        assert result[0].log_num == 24940
        assert result[0].sclk == 759350569
        assert result[0].module == 'DRIVE'
        assert result[0].message == 'Drive started'
        assert result[0].name == 'DRIVE_START'
        assert result[0].event_id == 1001
        assert result[0].level == 'INFO'


class TestTelemetryService:
    """Tests for TelemetryService."""
    
    def test_get_mobility_telemetry_success(self, mock_db_session, sample_mobility_telemetry_points):
        """Test successful retrieval of mobility telemetry."""
        # Arrange
        service = TelemetryService(mock_db_session)
        
        # Act
        with patch.object(service.telemetry_repo, 'get_mobility_telemetry', return_value=sample_mobility_telemetry_points):
            result = service.get_mobility_telemetry(759350569, 759359342)
        
        # Assert
        assert isinstance(result, MobilityTelemetryResponse)
        assert result.start_sclk == 759350569
        assert result.end_sclk == 759359342
        assert result.point_count == 2
        assert len(result.telemetry) == 2
        assert result.telemetry[0].sclk == 759350569
        assert result.telemetry[0].accel_x == 0.1
    
    def test_get_mobility_telemetry_invalid_range(self, mock_db_session):
        """Test mobility telemetry with invalid SCLK range."""
        # Arrange
        service = TelemetryService(mock_db_session)
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            service.get_mobility_telemetry(759359342, 759350569)  # start > end
        
        assert exc_info.value.status_code == 400
        assert "start_sclk must be less than end_sclk" in str(exc_info.value.detail)
    
    def test_get_motor_telemetry_success(self, mock_db_session):
        """Test successful retrieval of motor telemetry."""
        # Arrange
        service = TelemetryService(mock_db_session)
        from models import MotorTelemetryPoint
        mock_motors_data = {
            'DRIVE_LF': [
                MotorTelemetryPoint(
                    sclk=759350569, motor_name='DRIVE_LF', odom=100.0,
                    angle=45.0, voltage=12.0, field=1.0, state=1,
                    cbrake_ma=0.0, cmotor=2.0, cstatus=1, cbrake_status=0,
                    tprt1=25.0, angular_rate=0.5
                ),
                MotorTelemetryPoint(
                    sclk=759350570, motor_name='DRIVE_LF', odom=101.0,
                    angle=46.0, voltage=12.1, field=1.1, state=1,
                    cbrake_ma=0.0, cmotor=2.1, cstatus=1, cbrake_status=0,
                    tprt1=25.1, angular_rate=0.6
                )
            ]
        }
        
        # Act
        with patch.object(service.telemetry_repo, 'get_motor_telemetry', return_value=mock_motors_data):
            result = service.get_motor_telemetry(759350569, 759359342)
        
        # Assert
        assert isinstance(result, MotorTelemetryResponse)
        assert result.start_sclk == 759350569
        assert result.end_sclk == 759359342
        assert result.point_count == 2
        assert 'DRIVE_LF' in result.motors
        assert len(result.motors['DRIVE_LF']) == 2
    
    def test_get_available_motors_success(self, mock_db_session):
        """Test successful retrieval of available motors."""
        # Arrange
        service = TelemetryService(mock_db_session)
        mock_motors = ['DRIVE_LF', 'DRIVE_RF', 'DRIVE_LR']
        
        # Act
        with patch.object(service.telemetry_repo, 'get_available_motors', return_value=mock_motors):
            result = service.get_available_motors()
        
        # Assert
        assert isinstance(result, MotorListResponse)
        assert result.motors == ['DRIVE_LF', 'DRIVE_RF', 'DRIVE_LR']
        assert result.total_count == 3
    
    def test_get_telemetry_data_success(self, mock_db_session, sample_sol_data):
        """Test successful retrieval of telemetry data for a parameter."""
        # Arrange
        service = TelemetryService(mock_db_session)
        mock_sol_metadata = pd.Series(sample_sol_data)
        mock_telemetry_results = [
            Mock(sclk=759350569, elevation=-100.5),
            Mock(sclk=759350570, elevation=-100.6)
        ]
        mock_range_result = Mock(min_value=-100.7, max_value=-100.5)
        
        # Act
        with patch.object(service.sol_repo, 'get_sol_metadata', return_value=mock_sol_metadata), \
             patch.object(service.db, 'execute') as mock_execute:
            
            mock_execute.return_value.fetchall.return_value = mock_telemetry_results
            mock_execute.return_value.fetchone.return_value = mock_range_result
            
            result = service.get_telemetry_data(1041, 'elevation')
        
        # Assert
        assert isinstance(result, ChartDataResponse)
        assert result.sol == 1041
        assert result.parameter == 'elevation'
        assert result.min_value == -100.7
        assert result.max_value == -100.5
        assert len(result.data) == 2
    
    def test_get_nearest_sclk_success(self, mock_db_session):
        """Test successful nearest SCLK lookup."""
        # Arrange
        service = TelemetryService(mock_db_session)
        mock_nearest = Mock(
            sclk=759350569,
            distance=5.0,
            easting=123456.0,
            northing=987654.0,
            elevation=-100.5,
            terrain='bedrock'
        )
        
        # Act
        with patch.object(service.map_repo, 'find_nearest_sclk', return_value=mock_nearest):
            result = service.get_nearest_sclk(123456.0, 987654.0)
        
        # Assert
        assert result == mock_nearest
    
    def test_validate_segment_success(self, mock_db_session):
        """Test successful segment validation."""
        # Arrange
        service = TelemetryService(mock_db_session)
        mock_metadata = Mock(
            start_sclk=759350569,
            end_sclk=759359342,
            duration=8773.0,
            point_count=242,
            distance=15.5,
            sols_covered=[1041]
        )
        
        # Act
        with patch.object(service.map_repo, 'get_segment_metadata', return_value=mock_metadata):
            result = service.validate_segment(759350569, 759359342)
        
        # Assert
        assert isinstance(result, SegmentValidationResponse)
        assert result.valid is True
        assert result.duration == 8773.0
        assert result.point_count == 242
        assert result.distance == 15.5
        assert result.sols_covered == [1041]
        assert result.error is None
    
    def test_validate_segment_invalid_range(self, mock_db_session):
        """Test segment validation with invalid SCLK range."""
        # Arrange
        service = TelemetryService(mock_db_session)
        
        # Act
        result = service.validate_segment(759359342, 759350569)  # start > end
        
        # Assert
        assert isinstance(result, SegmentValidationResponse)
        assert result.valid is False
        assert result.duration == 0.0
        assert result.point_count == 0
        assert "Start SCLK must be less than end SCLK" in result.error


class TestFaultService:
    """Tests for FaultService."""
    
    def test_get_faults_for_sol_success(self, mock_db_session, sample_fault_records):
        """Test successful retrieval of faults for a sol."""
        # Arrange
        service = FaultService(mock_db_session)
        
        # Act
        with patch.object(service.fault_repo, 'get_faults_for_sol', return_value=sample_fault_records):
            result = service.get_faults_for_sol(1041)
        
        # Assert
        assert len(result) == 2
        assert result[0].sclk == 759350569
        assert result[0].fault_type == 'WHEEL_SLIP'
        assert result[1].fault_type == 'TERRAIN_HAZARD'


class TestEVRService:
    """Tests for EVRService."""
    
    def test_get_evrs_for_sol_success(self, mock_db_session, sample_evr_records):
        """Test successful retrieval of EVRs for a sol."""
        # Arrange
        service = EVRService(mock_db_session)
        
        # Act
        with patch.object(service.evr_repo, 'get_evrs_for_sol', return_value=pd.DataFrame()), \
             patch.object(service, '_convert_evrs_to_records', return_value=sample_evr_records):
            result = service.get_evrs_for_sol(1041)
        
        # Assert
        assert len(result) == 2
        assert result[0].log_num == 24940
        assert result[0].module == 'DRIVE'
        assert result[1].log_num == 24941
    
    def test_stream_evrs_success(self, mock_db_session, sample_evr_records):
        """Test successful EVR streaming."""
        # Arrange
        service = EVRService(mock_db_session)
        mock_df = pd.DataFrame({
            'log_num': [24940, 24941],
            'sclk': [759350569, 759350570],
            'module': ['DRIVE', 'DRIVE'],
            'message': ['Drive started', 'Drive in progress'],
            'name': ['DRIVE_START', 'DRIVE_PROGRESS'],
            'event_id': [1001, 1002],
            'level': ['INFO', 'INFO']
        })
        
        # Act
        with patch.object(service.evr_repo, 'get_evrs_stream', return_value=mock_df), \
             patch.object(service, '_convert_evrs_to_records', return_value=sample_evr_records):
            result = service.stream_evrs(sol=1041, limit=10)
        
        # Assert
        assert result.items == sample_evr_records
        assert result.total_returned == 2
        assert result.next_cursor_sclk is None
        assert result.next_cursor_log is None
    
    def test_get_evr_facets_success(self, mock_db_session):
        """Test successful retrieval of EVR facets."""
        # Arrange
        service = EVRService(mock_db_session)
        mock_facets = {
            "modules": [{"value": "DRIVE", "count": 10}],
            "names": [{"value": "DRIVE_START", "count": 5}],
            "levels": [{"value": "INFO", "count": 8}]
        }
        
        # Act
        with patch.object(service.evr_repo, 'get_evr_facets', return_value=mock_facets):
            result = service.get_evr_facets(1041)
        
        # Assert
        assert 'modules' in result
        assert 'names' in result
        assert 'levels' in result
        assert len(result['modules']) == 1
        assert result['modules'][0].value == 'DRIVE'
        assert result['modules'][0].count == 10


class TestMapService:
    """Tests for MapService."""
    
    def test_get_map_bounds_success(self):
        """Test successful retrieval of map bounds."""
        # Arrange
        service = MapService()
        
        # Act
        result = service.get_map_bounds()
        
        # Assert
        assert 'minZoom' in result
        assert 'maxNativeZoom' in result
        assert 'maxZoom' in result
        assert 'tileSize' in result
        assert 'attribution' in result
        assert 'bounds' in result
        assert 'center' in result
        assert result['tileSize'] == 256
        assert result['attribution'] == 'Mars Orbital Map - NASA/JPL'
    
    def test_get_rover_path_success(self):
        """Test successful retrieval of rover path."""
        # Arrange
        service = MapService()
        mock_path_data = {
            "points": [
                {"latitude": 18.5, "longitude": 77.3, "sclk": 759350569},
                {"latitude": 18.6, "longitude": 77.4, "sclk": 759350570}
            ],
            "description": "Test rover path",
            "total_points": 2,
            "decimation_factor": 1
        }
        
        # Act
        with patch('builtins.open', create=True), \
             patch('json.load', return_value=mock_path_data):
            result = service.get_rover_path(detail='medium')
        
        # Assert
        assert result['detail_level'] == 'medium'
        assert result['total_points'] == 2
        assert result['original_total_points'] == 2
        assert result['decimation_factor'] == 1
        assert result['description'] == 'Test rover path'
        assert len(result['points']) == 2
    
    def test_get_rover_path_invalid_detail(self):
        """Test rover path retrieval with invalid detail level."""
        # Arrange
        service = MapService()
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            service.get_rover_path(detail='invalid')
        
        assert exc_info.value.status_code == 400
        assert "Invalid detail level" in str(exc_info.value.detail)
    
    def test_get_rover_path_sols_success(self):
        """Test successful retrieval of rover path sols."""
        # Arrange
        service = MapService()
        mock_sols_data = {
            "total_sols": 15,
            "description": "Test sols data",
            "sols": [
                {"sol": 1041, "start_sclk": 759350569, "end_sclk": 759359342},
                {"sol": 1042, "start_sclk": 759359343, "end_sclk": 759368000}
            ]
        }
        
        # Act
        with patch('builtins.open', create=True), \
             patch('json.load', return_value=mock_sols_data):
            result = service.get_rover_path_sols()
        
        # Assert
        assert result['total_sols'] == 15
        assert result['description'] == 'Test sols data'
        assert len(result['sols']) == 2
        assert result['sols'][0]['sol'] == 1041
        assert result['sols'][1]['sol'] == 1042


class TestSearchService:
    """Tests for SearchService."""
    
    def test_execute_explicit_query_success(self, mock_db_session):
        """Test successful explicit query execution."""
        # Arrange
        service = SearchService(mock_db_session)
        from models import ExplicitQueryRequest, ExplicitQueryFilter
        
        request = ExplicitQueryRequest(
            filters=[
                ExplicitQueryFilter(
                    field="distance",
                    operator="gt",
                    value=10.0
                )
            ],
            limit=10
        )
        
        mock_results = [
            SolListItem(sol=1041, distance=15.5, start_sclk=759350569, end_sclk=759359342),
            SolListItem(sol=1042, distance=12.3, start_sclk=759359343, end_sclk=759368000)
        ]
        
        # Act
        with patch.object(service.search_repo, 'execute_explicit_query', return_value=mock_results):
            result = service.execute_explicit_query(request)
        
        # Assert
        assert len(result) == 2
        assert result[0].sol == 1041
        assert result[0].distance == 15.5
        assert result[1].sol == 1042
        assert result[1].distance == 12.3


class TestImageService:
    """Tests for ImageService."""
    
    def test_get_sol_pdi_success(self, mock_db_session):
        """Test successful retrieval of PDI data for a sol."""
        # Arrange
        service = ImageService(mock_db_session)
        mock_df = pd.DataFrame({
            'sol': [1041],
            'fhaz_left_filename': ['FLF_1041.png'],
            'fhaz_left_sclk': [759350569],
            'fhaz_right_filename': ['FRF_1041.png'],
            'fhaz_right_sclk': [759350569],
            'rhaz_left_filename': ['RLF_1041.png'],
            'rhaz_left_sclk': [759350569],
            'rhaz_right_filename': ['RRF_1041.png'],
            'rhaz_right_sclk': [759350569],
            'ncam_left_filename': ['NLF_1041.png'],
            'ncam_left_sclk': [759350569],
            'ncam_right_filename': ['NRF_1041.png'],
            'ncam_right_sclk': [759350569]
        })
        
        # Act
        with patch.object(service.repo, 'execute_query', return_value=mock_df):
            result = service.get_sol_pdi(1041)
        
        # Assert
        assert result is not None
        assert result.sol == 1041
        assert result.fhaz.camera_type == 'fhaz'
        assert result.fhaz.description == 'Front Hazcam'
        assert result.fhaz.left.filename == 'FLF_1041.png'
        assert result.fhaz.right.filename == 'FRF_1041.png'
        assert result.rhaz.camera_type == 'rhaz'
        assert result.ncam.camera_type == 'ncam'
    
    def test_get_sol_pdi_not_found(self, mock_db_session):
        """Test retrieval of PDI data for non-existent sol."""
        # Arrange
        service = ImageService(mock_db_session)
        
        # Act
        with patch.object(service.repo, 'execute_query', return_value=pd.DataFrame()):
            result = service.get_sol_pdi(9999)
        
        # Assert
        assert result is None
    
    def test_get_sol_vce_success(self, mock_db_session):
        """Test successful retrieval of VCE data for a sol."""
        # Arrange
        service = ImageService(mock_db_session)
        mock_df = pd.DataFrame({
            'sol': [1041, 1041],
            'sclk': [759350569, 759350570],
            'left_filename': ['VCE_LEFT_1.png', 'VCE_LEFT_2.png'],
            'right_filename': ['VCE_RIGHT_1.png', 'VCE_RIGHT_2.png']
        })
        
        # Act
        with patch.object(service.repo, 'execute_query', return_value=mock_df):
            result = service.get_sol_vce(1041)
        
        # Assert
        assert result is not None
        assert result.sol == 1041
        assert len(result.images) == 2
        assert result.images[0].sclk == 759350569
        assert result.images[0].left_filename == 'VCE_LEFT_1.png'
        assert result.images[0].right_filename == 'VCE_RIGHT_1.png'
        assert result.images[1].sclk == 759350570
        assert result.images[1].left_filename == 'VCE_LEFT_2.png'
        assert result.images[1].right_filename == 'VCE_RIGHT_2.png'
    
    def test_get_sol_vce_not_found(self, mock_db_session):
        """Test retrieval of VCE data for non-existent sol."""
        # Arrange
        service = ImageService(mock_db_session)
        
        # Act
        with patch.object(service.repo, 'execute_query', return_value=pd.DataFrame()):
            result = service.get_sol_vce(9999)
        
        # Assert
        assert result is None
