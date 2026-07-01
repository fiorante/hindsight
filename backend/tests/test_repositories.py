"""
Tests for the repository layer.
"""

import pytest
import pandas as pd
from unittest.mock import Mock, patch
from fastapi import HTTPException

from database.repositories.sol_repository import SolRepository
from database.repositories.telemetry_repository import TelemetryRepository
from database.repositories.evr_repository import EVRRepository
from database.repositories.fault_repository import FaultRepository
from database.repositories.search_repository import SearchRepository
from database.repositories.map_repository import MapRepository
from models import SolListItem, MobilityTelemetryPoint, MotorTelemetryPoint


class TestSolRepository:
    """Tests for SolRepository."""
    
    def test_get_all_sols_success(self, mock_db_session, sample_sol_data):
        """Test successful retrieval of all sols."""
        # Arrange
        repo = SolRepository(mock_db_session)
        mock_df = pd.DataFrame([sample_sol_data])
        mock_db_session.execute.return_value.fetchall.return_value = [
            (1041, 15.5, 759350569, 759359342, 8773.0, 242)
        ]
        mock_db_session.execute.return_value.keys.return_value = [
            'sol', 'distance', 'start_sclk', 'end_sclk', 'duration', 'point_count'
        ]
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.get_all_sols()
        
        # Assert
        assert len(result) == 1
        assert result[0].sol == 1041
        assert result[0].distance == 15.5
        assert result[0].start_sclk == 759350569
        assert result[0].end_sclk == 759359342
    
    def test_get_all_sols_empty(self, mock_db_session):
        """Test retrieval of sols when none exist."""
        # Arrange
        repo = SolRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=pd.DataFrame()):
            result = repo.get_all_sols()
        
        # Assert
        assert result == []
    
    def test_get_sol_metadata_success(self, mock_db_session, sample_sol_data):
        """Test successful retrieval of sol metadata."""
        # Arrange
        repo = SolRepository(mock_db_session)
        mock_df = pd.DataFrame([sample_sol_data])
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.get_sol_metadata(1041)
        
        # Assert
        assert result is not None
        assert result['sol'] == 1041
        assert result['distance'] == 15.5
    
    def test_get_sol_metadata_not_found(self, mock_db_session):
        """Test retrieval of non-existent sol metadata."""
        # Arrange
        repo = SolRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=pd.DataFrame()):
            result = repo.get_sol_metadata(9999)
        
        # Assert
        assert result is None
    
    def test_get_sols_for_similarity_search(self, mock_db_session):
        """Test retrieval of sols for similarity search."""
        # Arrange
        repo = SolRepository(mock_db_session)
        mock_df = pd.DataFrame({
            'sol': [1041, 1042],
            'start_sclk': [759350569, 759359343],
            'end_sclk': [759359342, 759368000],
            'distance': [15.5, 12.3],
            'duration': [8773.0, 8657.0],
            'point_count': [242, 198]
        })
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.get_sols_for_similarity_search()
        
        # Assert
        assert len(result) == 2
        assert result.iloc[0]['sol'] == 1041
        assert result.iloc[1]['sol'] == 1042
    
    def test_get_sols_by_sclk_range(self, mock_db_session):
        """Test retrieval of sols by SCLK range."""
        # Arrange
        repo = SolRepository(mock_db_session)
        mock_df = pd.DataFrame({'sol': [1041, 1042]})
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.get_sols_by_sclk_range(759350569, 759359342)
        
        # Assert
        assert result == [1041, 1042]


class TestTelemetryRepository:
    """Tests for TelemetryRepository."""
    
    def test_get_drive_telemetry_success(self, mock_db_session, sample_telemetry_data):
        """Test successful retrieval of drive telemetry."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_telemetry_data):
            result = repo.get_drive_telemetry(759350569, 759359342)
        
        # Assert
        assert len(result) == 3
        assert result.iloc[0]['sclk'] == 759350569
        assert result.iloc[0]['easting'] == 123456.0
    
    def test_get_mobility_telemetry_success(self, mock_db_session, sample_mobility_telemetry_data):
        """Test successful retrieval of mobility telemetry."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_mobility_telemetry_data):
            result = repo.get_mobility_telemetry(759350569, 759359342)
        
        # Assert
        assert len(result) == 2
        assert isinstance(result[0], MobilityTelemetryPoint)
        assert result[0].sclk == 759350569
        assert result[0].accel_x == 0.1
    
    def test_get_mobility_telemetry_empty(self, mock_db_session):
        """Test retrieval of mobility telemetry when none exists."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=pd.DataFrame()):
            result = repo.get_mobility_telemetry(759350569, 759359342)
        
        # Assert
        assert result == []
    
    def test_get_motor_telemetry_success(self, mock_db_session, sample_motor_telemetry_data):
        """Test successful retrieval of motor telemetry."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_motor_telemetry_data):
            result = repo.get_motor_telemetry(759350569, 759359342)
        
        # Assert
        assert 'DRIVE_LF' in result
        assert len(result['DRIVE_LF']) == 2
        assert isinstance(result['DRIVE_LF'][0], MotorTelemetryPoint)
        assert result['DRIVE_LF'][0].motor_name == 'DRIVE_LF'
    
    def test_get_motor_telemetry_with_filter(self, mock_db_session, sample_motor_telemetry_data):
        """Test retrieval of motor telemetry with motor name filter."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        motor_names = ['DRIVE_LF']
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_motor_telemetry_data):
            result = repo.get_motor_telemetry(759350569, 759359342, motor_names)
        
        # Assert
        assert 'DRIVE_LF' in result
        assert len(result['DRIVE_LF']) == 2
    
    def test_get_available_motors_success(self, mock_db_session):
        """Test successful retrieval of available motors."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        mock_df = pd.DataFrame({'motor_name': ['DRIVE_LF', 'DRIVE_RF', 'DRIVE_LR']})
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.get_available_motors()
        
        # Assert
        assert result == ['DRIVE_LF', 'DRIVE_RF', 'DRIVE_LR']
    
    def test_get_available_motors_empty(self, mock_db_session):
        """Test retrieval of available motors when none exist."""
        # Arrange
        repo = TelemetryRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=pd.DataFrame()):
            result = repo.get_available_motors()
        
        # Assert
        assert result == []


class TestEVRRepository:
    """Tests for EVRRepository."""
    
    def test_get_evrs_for_sclk_range_success(self, mock_db_session, sample_evr_data):
        """Test successful retrieval of EVRs for SCLK range."""
        # Arrange
        repo = EVRRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_evr_data):
            result = repo.get_evrs_for_sclk_range(759350569, 759359342)
        
        # Assert
        assert len(result) == 3
        assert result.iloc[0]['log_num'] == 24940
        assert result.iloc[0]['module'] == 'DRIVE'
    
    def test_get_evrs_for_sol_success(self, mock_db_session, sample_evr_data):
        """Test successful retrieval of EVRs for a sol."""
        # Arrange
        repo = EVRRepository(mock_db_session)
        
        # Act
        with patch.object(repo, 'execute_query', return_value=sample_evr_data):
            result = repo.get_evrs_for_sol(1041)
        
        # Assert
        assert len(result) == 3
        assert result.iloc[0]['log_num'] == 24940
    
    def test_get_evrs_stream_success(self, mock_db_session, sample_evr_data):
        """Test successful EVR streaming with pagination."""
        # Arrange
        repo = EVRRepository(mock_db_session)
        mock_sol_df = pd.DataFrame({
            'sol': [1041],
            'start_sclk': [759350569],
            'end_sclk': [759359342]
        })
        
        # Act
        with patch.object(repo, 'execute_query') as mock_execute:
            mock_execute.side_effect = [mock_sol_df, sample_evr_data]
            result = repo.get_evrs_stream(
                sol=1041,
                limit=10,
                direction="next"
            )
        
        # Assert
        assert len(result) == 3
        assert result.iloc[0]['log_num'] == 24940
    
    def test_get_evr_facets_success(self, mock_db_session):
        """Test successful retrieval of EVR facets."""
        # Arrange
        repo = EVRRepository(mock_db_session)
        mock_sol_df = pd.DataFrame({
            'sol': [1041],
            'start_sclk': [759350569],
            'end_sclk': [759359342]
        })
        mock_modules_df = pd.DataFrame({
            'value': ['DRIVE', 'NAV'],
            'count': [10, 5]
        })
        mock_names_df = pd.DataFrame({
            'value': ['DRIVE_START', 'DRIVE_END'],
            'count': [5, 5]
        })
        mock_levels_df = pd.DataFrame({
            'value': ['INFO', 'WARNING'],
            'count': [8, 2]
        })
        
        # Act
        with patch.object(repo, 'execute_query') as mock_execute:
            mock_execute.side_effect = [mock_sol_df, mock_modules_df, mock_names_df, mock_levels_df]
            result = repo.get_evr_facets(1041)
        
        # Assert
        assert 'modules' in result
        assert 'names' in result
        assert 'levels' in result
        assert len(result['modules']) == 2
        assert len(result['names']) == 2
        assert len(result['levels']) == 2


class TestFaultRepository:
    """Tests for FaultRepository."""
    
    def test_get_faults_for_sol_success(self, mock_db_session, sample_fault_data):
        """Test successful retrieval of faults for a sol."""
        # Arrange
        repo = FaultRepository(mock_db_session)
        mock_sol_df = pd.DataFrame({'sol': [1041]})
        
        # Act
        with patch.object(repo, 'execute_query') as mock_execute:
            mock_execute.side_effect = [mock_sol_df, sample_fault_data]
            result = repo.get_faults_for_sol(1041)
        
        # Assert
        assert len(result) == 2
        assert result[0].sclk == 759350569
        assert result[0].fault_type == 'WHEEL_SLIP'
        assert result[1].fault_type == 'TERRAIN_HAZARD'
    
    def test_get_faults_for_sol_not_found(self, mock_db_session):
        """Test retrieval of faults for non-existent sol."""
        # Arrange
        repo = FaultRepository(mock_db_session)
        
        # Act & Assert
        with patch.object(repo, 'execute_query', return_value=pd.DataFrame()):
            with pytest.raises(HTTPException) as exc_info:
                repo.get_faults_for_sol(9999)
        
        assert exc_info.value.status_code == 404
        assert "Sol 9999 not found" in str(exc_info.value.detail)
    
    def test_get_faults_for_sol_no_faults(self, mock_db_session):
        """Test retrieval of faults when sol exists but has no faults."""
        # Arrange
        repo = FaultRepository(mock_db_session)
        mock_sol_df = pd.DataFrame({'sol': [1041]})
        
        # Act
        with patch.object(repo, 'execute_query') as mock_execute:
            mock_execute.side_effect = [mock_sol_df, pd.DataFrame()]
            result = repo.get_faults_for_sol(1041)
        
        # Assert
        assert result == []


class TestSearchRepository:
    """Tests for SearchRepository."""
    
    def test_execute_explicit_query_simple(self, mock_db_session):
        """Test simple explicit query execution."""
        # Arrange
        repo = SearchRepository(mock_db_session)
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
        
        mock_df = pd.DataFrame({
            'sol': [1041, 1042],
            'distance': [15.5, 12.3],
            'start_sclk': [759350569, 759359343],
            'end_sclk': [759359342, 759368000],
            'duration': [8773.0, 8657.0],
            'point_count': [242, 198]
        })
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.execute_explicit_query(request)
        
        # Assert
        assert len(result) == 2
        assert result[0].sol == 1041
        assert result[0].distance == 15.5
        assert result[1].sol == 1042
        assert result[1].distance == 12.3
    
    def test_execute_explicit_query_with_sol_range(self, mock_db_session):
        """Test explicit query with sol range filter."""
        # Arrange
        repo = SearchRepository(mock_db_session)
        from models import ExplicitQueryRequest
        
        request = ExplicitQueryRequest(
            sol_range=(1041, 1045),
            limit=10
        )
        
        mock_df = pd.DataFrame({
            'sol': [1041, 1042],
            'distance': [15.5, 12.3],
            'start_sclk': [759350569, 759359343],
            'end_sclk': [759359342, 759368000],
            'duration': [8773.0, 8657.0],
            'point_count': [242, 198]
        })
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.execute_explicit_query(request)
        
        # Assert
        assert len(result) == 2
        assert result[0].sol == 1041
        assert result[1].sol == 1042


class TestMapRepository:
    """Tests for MapRepository."""
    
    def test_find_nearest_sclk_success(self, mock_db_session):
        """Test successful nearest SCLK lookup."""
        # Arrange
        repo = MapRepository(mock_db_session)
        mock_df = pd.DataFrame({
            'sclk': [759350569],
            'easting': [123456.0],
            'northing': [987654.0],
            'elevation': [-100.5],
            'terrain': ['bedrock'],
            'distance': [5.0]
        })
        
        # Act
        with patch.object(repo, 'execute_query', return_value=mock_df):
            result = repo.find_nearest_sclk(123456.0, 987654.0)
        
        # Assert
        assert result.sclk == 759350569
        assert result.distance == 5.0
        assert result.easting == 123456.0
        assert result.northing == 987654.0
    
    def test_find_nearest_sclk_too_far(self, mock_db_session):
        """Test nearest SCLK lookup when point is too far."""
        # Arrange
        repo = MapRepository(mock_db_session)
        mock_df = pd.DataFrame({
            'sclk': [759350569],
            'easting': [123456.0],
            'northing': [987654.0],
            'elevation': [-100.5],
            'terrain': ['bedrock'],
            'distance': [15.0]  # More than 10m threshold
        })
        
        # Act & Assert
        with patch.object(repo, 'execute_query', return_value=mock_df):
            with pytest.raises(HTTPException) as exc_info:
                repo.find_nearest_sclk(123456.0, 987654.0)
        
        assert exc_info.value.status_code == 404
        assert "Nearest point is 15.0m away" in str(exc_info.value.detail)
    
    def test_get_segment_metadata_success(self, mock_db_session):
        """Test successful segment metadata calculation."""
        # Arrange
        repo = MapRepository(mock_db_session)
        mock_telemetry_df = pd.DataFrame({
            'sclk': [759350569, 759350570, 759350571],
            'easting': [123456.0, 123457.0, 123458.0],
            'northing': [987654.0, 987655.0, 987656.0],
            'elevation': [-100.5, -100.6, -100.7],
            'slope': [2.1, 2.2, 2.3],
            'heading': [45.0, 45.1, 45.2],
            'velocity': [0.5, 0.6, 0.7],
            'terrain': ['bedrock', 'bedrock', 'sand']
        })
        mock_sols_df = pd.DataFrame({'sol': [1041]})
        
        # Act
        with patch.object(repo, 'execute_query') as mock_execute:
            mock_execute.side_effect = [mock_telemetry_df, mock_sols_df]
            result = repo.get_segment_metadata(759350569, 759359342)
        
        # Assert
        assert result.start_sclk == 759350569
        assert result.end_sclk == 759359342
        assert result.point_count == 3
        assert result.duration == 8773.0  # end_sclk - start_sclk
        assert result.sols_covered == [1041]
        assert result.distance is not None  # Should calculate distance from coordinates
