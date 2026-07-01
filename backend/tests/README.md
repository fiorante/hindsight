# Backend Testing Guide

This directory contains unit tests for the Hindsight backend API.

## Test Structure

```
tests/
├── conftest.py              # Pytest configuration and fixtures
├── test_repositories.py     # Repository layer tests
├── test_services.py         # Service layer tests
├── test_routers.py          # Router/API endpoint tests
├── requirements-test.txt    # Test dependencies
├── run_tests.py            # Test runner script
└── README.md               # This file
```

## Quick Start

### Install Test Dependencies

```bash
cd backend
pip install -r tests/requirements-test.txt
```

### Run All Tests

```bash
# Using the test runner script
python tests/run_tests.py

# Or directly with pytest
pytest tests/ -v --cov=. --cov-report=html:tests/coverage_html
```

### Run Specific Tests

```bash
# Run specific test file
python tests/run_tests.py test_repositories.py

# Run specific test class
pytest tests/test_services.py::TestSolService -v

# Run specific test method
pytest tests/test_routers.py::TestHealthRouter::test_root_endpoint -v
```

## Test Coverage

The test suite covers all layers of the backend architecture:

### Repository Layer (`test_repositories.py`)
- SolRepository: Sol data access patterns
- TelemetryRepository: Telemetry data retrieval
- EVRRepository: Event record operations
- FaultRepository: Fault data access
- SearchRepository: Explicit query execution
- MapRepository: Map and coordinate operations

### Service Layer (`test_services.py`)
- SolService, TelemetryService, SimilarityService
- FaultService, EVRService, MapService, SearchService, ImageService

### Router Layer (`test_routers.py`)
- HealthRouter, SolsRouter, TelemetryRouter
- SearchRouter, FaultsRouter, EVRSRouter, MapsRouter

## Test Statistics

- **Total Tests**: 50+ test cases
- **Coverage Target**: 80% minimum
- **Test Types**: Unit tests with mocked dependencies

## Test Configuration

### Fixtures (`conftest.py`)

Available fixtures:
```python
sample_sol_data          # Sol metadata
sample_telemetry_data    # Telemetry DataFrame
sample_evr_data         # EVR DataFrame
sample_fault_data       # Fault DataFrame
sample_sol_list         # List of SolListItem objects
sample_telemetry_points # List of TelemetryPoint objects
sample_evr_records      # List of EVRRecord objects
sample_fault_records    # List of FaultRecord objects
```

## Testing Patterns

### Repository Tests
```python
def test_get_all_sols_success(self, mock_db_session, sample_sol_data):
    repo = SolRepository(mock_db_session)
    with patch.object(repo, 'execute_query', return_value=mock_df):
        result = repo.get_all_sols()
    assert len(result) == 1
    assert result[0].sol == 1041
```

### Service Tests
```python
def test_get_sol_data_success(self, mock_db_session, sample_sol_data):
    service = SolService(mock_db_session)
    with patch.object(service.sol_repo, 'get_sol_metadata', return_value=mock_data):
        result = service.get_sol_data(1041)
    assert result is not None
    assert result.sol == 1041
```

### Router Tests
```python
def test_get_sols_list_success(self, client, sample_sol_list):
    with patch('routers.sols.SolService') as mock_service_class:
        mock_service = Mock()
        mock_service.get_sols_list.return_value = sample_sol_list
        mock_service_class.return_value = mock_service
        response = client.get("/sols/list")
    assert response.status_code == 200
```

## Error Testing

The test suite includes error handling tests for:
- 404 Not Found: Non-existent resources
- 400 Bad Request: Invalid parameters
- 500 Internal Server Error: Database failures
- Validation Errors: Invalid input data

## Continuous Integration

```yaml
# Example GitHub Actions workflow
- name: Run Backend Tests
  run: |
    cd backend
    pip install -r tests/requirements-test.txt
    pytest tests/ -v --cov=. --cov-fail-under=80
```

## Debugging Tests

```bash
# Run tests in debug mode
pytest tests/ -v -s --pdb

# Run with coverage details
pytest tests/ -v --cov=. --cov-report=term-missing
```

## Adding New Tests

### Repository Tests
```python
def test_new_repository_method(self, mock_db_session):
    repo = NewRepository(mock_db_session)
    with patch.object(repo, 'execute_query', return_value=mock_data):
        result = repo.new_method()
    assert result == expected_value
```

### Service Tests
```python
def test_new_service_method(self, mock_db_session):
    service = NewService(mock_db_session)
    with patch.object(service.repo, 'new_method', return_value=mock_data):
        result = service.new_method()
    assert result == expected_value
```

### Router Tests
```python
def test_new_endpoint(self, client):
    with patch('routers.new.NewService') as mock_service_class:
        mock_service = Mock()
        mock_service.new_method.return_value = mock_data
        mock_service_class.return_value = mock_service
        response = client.get("/new/endpoint")
    assert response.status_code == 200
```
