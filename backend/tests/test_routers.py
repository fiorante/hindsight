"""
Tests for the router layer.
"""

import pytest
import json
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

from main import app


class TestHealthRouter:
    """Tests for health endpoints."""
    
    def test_root_endpoint(self, client):
        """Test root endpoint returns API information."""
        # Act
        response = client.get("/")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Hindsight API"
        assert data["version"] == "1.0.0"
        assert "endpoints" in data
        assert "health" in data["endpoints"]
        assert "sols_list" in data["endpoints"]
    
    def test_health_check_success(self, client):
        """Test health check endpoint when database is connected."""
        # Act
        with patch('routers.health.get_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_connection = Mock()
            mock_connection.execute.return_value = None
            mock_engine.connect.return_value.__enter__ = Mock(return_value=mock_connection)
            mock_engine.connect.return_value.__exit__ = Mock(return_value=None)
            mock_get_engine.return_value = mock_engine
            
            response = client.get("/health")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database_connected"] is True
        assert "timestamp" in data
        assert data["version"] == "1.0.0"
    
    def test_health_check_database_disconnected(self, client):
        """Test health check endpoint when database is disconnected."""
        # Act
        with patch('routers.health.get_engine') as mock_get_engine:
            mock_get_engine.side_effect = Exception("Database connection failed")
            
            response = client.get("/health")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database_connected"] is False
        assert "timestamp" in data


class TestSolsRouter:
    """Tests for sols endpoints."""
    
    def test_get_sols_list_success(self, client, sample_sol_list):
        """Test successful retrieval of sols list."""
        # Act
        with patch('routers.sols.SolService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_sols_list.return_value = sample_sol_list
            mock_service_class.return_value = mock_service
            
            response = client.get("/sols/list")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["sol"] == 1041
        assert data[0]["distance"] == 15.5
        assert data[1]["sol"] == 1042
        assert data[1]["distance"] == 12.3
    
    def test_get_sol_data_success(self, client):
        """Test successful retrieval of sol data."""
        # Arrange
        mock_sol_data = Mock(
            sol=1041,
            distance=15.5,
            start_sclk=759350569,
            end_sclk=759359342,
            duration=8773.0,
            point_count=242,
            telemetry=[],
            evrs=[],
            pdi=None
        )
        
        # Act
        with patch('routers.sols.SolService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_sol_data.return_value = mock_sol_data
            mock_service_class.return_value = mock_service
            
            response = client.get("/sols/1041")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["sol"] == 1041
        assert data["distance"] == 15.5
        assert data["start_sclk"] == 759350569
        assert data["end_sclk"] == 759359342
    
    def test_get_sol_data_not_found(self, client):
        """Test retrieval of non-existent sol data."""
        # Act
        with patch('routers.sols.SolService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_sol_data.return_value = None
            mock_service_class.return_value = mock_service
            
            response = client.get("/sols/9999")
        
        # Assert
        assert response.status_code == 404
        data = response.json()
        assert "The requested resource was not found" in data["detail"]


class TestTelemetryRouter:
    """Tests for telemetry endpoints."""
    
    def test_get_mobility_telemetry_success(self, client, sample_mobility_telemetry_points):
        """Test successful retrieval of mobility telemetry."""
        # Arrange
        mock_response = Mock(
            start_sclk=759350569,
            end_sclk=759359342,
            point_count=2,
            telemetry=sample_mobility_telemetry_points
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_mobility_telemetry.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/mobility?start_sclk=759350569&end_sclk=759359342")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["start_sclk"] == 759350569
        assert data["end_sclk"] == 759359342
        assert data["point_count"] == 2
        assert len(data["telemetry"]) == 2
    
    def test_get_mobility_telemetry_invalid_range(self, client):
        """Test mobility telemetry with invalid SCLK range."""
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_mobility_telemetry.side_effect = HTTPException(
                status_code=400, detail="start_sclk must be less than end_sclk"
            )
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/mobility?start_sclk=759359342&end_sclk=759350569")
        
        # Assert
        assert response.status_code == 400
        data = response.json()
        assert "start_sclk must be less than end_sclk" in data["detail"]
    
    def test_get_motor_telemetry_success(self, client):
        """Test successful retrieval of motor telemetry."""
        # Arrange
        from models import MotorTelemetryPoint
        mock_motor_point = MotorTelemetryPoint(
            sclk=759350569,
            motor_name="DRIVE_LF",
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
        )
        mock_response = Mock(
            start_sclk=759350569,
            end_sclk=759359342,
            point_count=2,
            motors={"DRIVE_LF": [mock_motor_point]}
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_motor_telemetry.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/motors?start_sclk=759350569&end_sclk=759359342")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["start_sclk"] == 759350569
        assert data["end_sclk"] == 759359342
        assert data["point_count"] == 2
        assert "DRIVE_LF" in data["motors"]
    
    def test_get_motor_telemetry_with_filter(self, client):
        """Test motor telemetry with motor name filter."""
        # Arrange
        from models import MotorTelemetryPoint
        mock_motor_point = MotorTelemetryPoint(
            sclk=759350569,
            motor_name="DRIVE_LF",
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
        )
        mock_response = Mock(
            start_sclk=759350569,
            end_sclk=759359342,
            point_count=1,
            motors={"DRIVE_LF": [mock_motor_point]}
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_motor_telemetry.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/motors?start_sclk=759350569&end_sclk=759359342&motors=DRIVE_LF")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["point_count"] == 1
        assert "DRIVE_LF" in data["motors"]
    
    def test_get_available_motors_success(self, client):
        """Test successful retrieval of available motors."""
        # Arrange
        mock_response = Mock(
            motors=["DRIVE_LF", "DRIVE_RF", "DRIVE_LR"],
            total_count=3
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_available_motors.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/motors/list")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["motors"] == ["DRIVE_LF", "DRIVE_RF", "DRIVE_LR"]
        assert data["total_count"] == 3
    
    def test_get_telemetry_data_success(self, client):
        """Test successful retrieval of telemetry data for a parameter."""
        # Arrange
        mock_response = Mock(
            sol=1041,
            parameter="elevation",
            data=[{"sclk": 759350569, "value": -100.5}],
            min_value=-100.7,
            max_value=-100.5
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_telemetry_data.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/1041/elevation")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["sol"] == 1041
        assert data["parameter"] == "elevation"
        assert data["min_value"] == -100.7
        assert data["max_value"] == -100.5
        assert len(data["data"]) == 1
    
    def test_get_telemetry_range_success(self, client):
        """Test successful retrieval of telemetry range."""
        # Arrange
        mock_response = {
            "sol": 1041,
            "parameter": "elevation",
            "min_value": -100.7,
            "max_value": -100.5
        }
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_telemetry_range.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/1041/elevation/range")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["sol"] == 1041
        assert data["parameter"] == "elevation"
        assert data["min_value"] == -100.7
        assert data["max_value"] == -100.5
    
    def test_get_nearest_sclk_success(self, client):
        """Test successful nearest SCLK lookup."""
        # Arrange
        mock_response = Mock(
            sclk=759350569,
            distance=5.0,
            easting=123456.0,
            northing=987654.0,
            elevation=-100.5,
            terrain="bedrock"
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_nearest_sclk.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/nearest?easting=123456.0&northing=987654.0")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["sclk"] == 759350569
        assert data["distance"] == 5.0
        assert data["easting"] == 123456.0
        assert data["northing"] == 987654.0
    
    def test_validate_segment_success(self, client):
        """Test successful segment validation."""
        # Arrange
        from models import SegmentValidationResponse
        mock_response = SegmentValidationResponse(
            valid=True,
            duration=8773.0,
            point_count=242,
            distance=15.5,
            sols_covered=[1041],
            error=None
        )
        
        # Act
        with patch('routers.telemetry.TelemetryService') as mock_service_class:
            mock_service = Mock()
            mock_service.validate_segment.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/telemetry/segments/validate?start_sclk=759350569&end_sclk=759359342")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["duration"] == 8773.0
        assert data["point_count"] == 242
        assert data["distance"] == 15.5
        assert data["sols_covered"] == [1041]


class TestSearchRouter:
    """Tests for search endpoints."""
    
    def test_similarity_search_success(self, client):
        """Test successful similarity search."""
        # Arrange
        from models import SimilaritySearchResponse, SimilarityResult
        mock_result = SimilarityResult(
            sol=1042,
            similarity_score=0.85,
            distance=12.3,
            duration=8657.0,
            point_count=198
        )
        mock_response = Mock(
            reference_metadata=Mock(
                start_sclk=759350569,
                end_sclk=759359342,
                duration=8773.0,
                point_count=242,
                distance=15.5,
                sols_covered=[1041]
            ),
            algorithm="dtw",
            variables=["elevation"],
            results=[mock_result],
            total_results=1
        )
        
        request_data = {
            "reference": {"type": "sol", "value": 1041},
            "config": {"algorithm": "dtw", "variables": ["elevation"]}
        }
        
        # Act
        with patch('routers.search.SimilarityService') as mock_service_class:
            mock_service = Mock()
            mock_service.perform_similarity_search.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.post("/query/similar", json=request_data)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["algorithm"] == "dtw"
        assert data["variables"] == ["elevation"]
        assert len(data["results"]) == 1
        assert data["total_results"] == 1
    
    def test_explicit_query_success(self, client):
        """Test successful explicit query."""
        # Arrange
        from models import SolListItem
        mock_results = [
            SolListItem(sol=1041, distance=15.5, start_sclk=759350569, end_sclk=759359342, duration=8773.0, point_count=242),
            SolListItem(sol=1042, distance=12.3, start_sclk=759359343, end_sclk=759368000, duration=8657.0, point_count=198)
        ]
        
        request_data = {
            "filters": [
                {"field": "distance", "operator": "gt", "value": 10.0}
            ],
            "limit": 10
        }
        
        # Act
        with patch('routers.search.SearchService') as mock_service_class:
            mock_service = Mock()
            mock_service.execute_explicit_query.return_value = mock_results
            mock_service_class.return_value = mock_service
            
            response = client.post("/query/explicit", json=request_data)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["sol"] == 1041
        assert data[0]["distance"] == 15.5
        assert data[1]["sol"] == 1042
        assert data[1]["distance"] == 12.3


class TestFaultsRouter:
    """Tests for faults endpoints."""
    
    def test_get_faults_for_sol_success(self, client, sample_fault_records):
        """Test successful retrieval of faults for a sol."""
        # Act
        with patch('routers.faults.FaultService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_faults_for_sol.return_value = sample_fault_records
            mock_service_class.return_value = mock_service
            
            response = client.get("/faults/1041")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["sclk"] == 759350569
        assert data[0]["fault_type"] == "WHEEL_SLIP"
        assert data[1]["fault_type"] == "TERRAIN_HAZARD"


class TestEVRSRouter:
    """Tests for EVRs endpoints."""
    
    def test_get_evrs_for_sol_success(self, client, sample_evr_records):
        """Test successful retrieval of EVRs for a sol."""
        # Act
        with patch('routers.evrs.EVRService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_evrs_for_sol.return_value = sample_evr_records
            mock_service_class.return_value = mock_service
            
            response = client.get("/evrs/1041")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["log_num"] == 24940
        assert data[0]["module"] == "DRIVE"
        assert data[1]["log_num"] == 24941
    
    def test_stream_evrs_success(self, client, sample_evr_records):
        """Test successful EVR streaming."""
        # Arrange
        mock_response = Mock(
            items=sample_evr_records,
            next_cursor_sclk=None,
            next_cursor_log=None,
            prev_cursor_sclk=None,
            prev_cursor_log=None,
            total_returned=2
        )
        
        # Act
        with patch('routers.evrs.EVRService') as mock_service_class:
            mock_service = Mock()
            mock_service.stream_evrs.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/evrs/1041/stream?limit=10&dir=next")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total_returned"] == 2
        assert data["next_cursor_sclk"] is None
        assert data["next_cursor_log"] is None
    
    def test_get_evr_facets_success(self, client):
        """Test successful retrieval of EVR facets."""
        # Arrange
        mock_response = {
            "modules": [{"value": "DRIVE", "count": 10}],
            "names": [{"value": "DRIVE_START", "count": 5}],
            "levels": [{"value": "INFO", "count": 8}]
        }
        
        # Act
        with patch('routers.evrs.EVRService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_evr_facets.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/evrs/1041/facets")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "modules" in data
        assert "names" in data
        assert "levels" in data
        assert len(data["modules"]) == 1
        assert data["modules"][0]["value"] == "DRIVE"
        assert data["modules"][0]["count"] == 10


class TestMapsRouter:
    """Tests for maps endpoints."""
    
    def test_get_map_bounds_success(self, client):
        """Test successful retrieval of map bounds."""
        # Arrange
        mock_response = {
            "minZoom": -5,
            "maxNativeZoom": -1,
            "maxZoom": 0,
            "tileSize": 256,
            "attribution": "Mars Orbital Map - NASA/JPL",
            "bounds": {
                "minLat": 18.41865155989587,
                "maxLat": 18.50823447169246,
                "minLng": 77.25338372796834,
                "maxLng": 77.47215676466411
            },
            "center": {
                "lat": 18.463443015794165,
                "lng": 77.36277024631622
            }
        }
        
        # Act
        with patch('routers.maps.MapService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_map_bounds.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/map/bounds")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["minZoom"] == -5
        assert data["maxNativeZoom"] == -1
        assert data["tileSize"] == 256
        assert data["attribution"] == "Mars Orbital Map - NASA/JPL"
        assert "bounds" in data
        assert "center" in data
    
    def test_get_rover_path_success(self, client):
        """Test successful retrieval of rover path."""
        # Arrange
        mock_response = {
            "detail_level": "medium",
            "total_points": 2,
            "original_total_points": 2,
            "decimation_factor": 1,
            "description": "Test rover path",
            "points": [
                {"latitude": 18.5, "longitude": 77.3, "sclk": 759350569},
                {"latitude": 18.6, "longitude": 77.4, "sclk": 759350570}
            ],
            "bounds_applied": False
        }
        
        # Act
        with patch('routers.maps.MapService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_rover_path.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/map/rover-path?detail=medium")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["detail_level"] == "medium"
        assert data["total_points"] == 2
        assert data["description"] == "Test rover path"
        assert len(data["points"]) == 2
    
    def test_get_rover_path_invalid_detail(self, client):
        """Test rover path retrieval with invalid detail level."""
        # Act
        with patch('routers.maps.MapService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_rover_path.side_effect = HTTPException(
                status_code=400, detail="Invalid detail level. Must be one of: ['low', 'medium', 'high', 'full']"
            )
            mock_service_class.return_value = mock_service
            
            response = client.get("/map/rover-path?detail=invalid")
        
        # Assert
        assert response.status_code == 400
        data = response.json()
        assert "Invalid detail level" in data["detail"]
    
    def test_get_rover_path_sols_success(self, client):
        """Test successful retrieval of rover path sols."""
        # Arrange
        mock_response = {
            "total_sols": 15,
            "description": "Test sols data",
            "sols": [
                {"sol": 1041, "start_sclk": 759350569, "end_sclk": 759359342},
                {"sol": 1042, "start_sclk": 759359343, "end_sclk": 759368000}
            ]
        }
        
        # Act
        with patch('routers.maps.MapService') as mock_service_class:
            mock_service = Mock()
            mock_service.get_rover_path_sols.return_value = mock_response
            mock_service_class.return_value = mock_service
            
            response = client.get("/map/rover-path/sols")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total_sols"] == 15
        assert data["description"] == "Test sols data"
        assert len(data["sols"]) == 2
        assert data["sols"][0]["sol"] == 1041
        assert data["sols"][1]["sol"] == 1042
