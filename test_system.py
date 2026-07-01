#!/usr/bin/env python3

"""
Test script to validate the Hindsight setup.

This script tests:
1. Database connectivity and schema
2. Data ingestion pipeline
3. Backend API endpoints
4. Similarity search functionality
"""

import os
import sys
import json
import time
import requests
import subprocess
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

sys.path.append(str(Path(__file__).parent))
from shared.config import load_env_file, get_database_url, get_server_config

load_env_file(Path(__file__).parent / '.env')

DATABASE_URL = get_database_url()
server_config = get_server_config()
API_BASE_URL = f"http://{server_config['host']}:{server_config['port']}"

def test_database_connection():
    """Test database connectivity and schema."""
    print("🔍 Testing database connection...")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Test basic connectivity
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection successful")
            
            # Check if tables exist
            tables_query = """
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sols', 'drive_telemetry', 'evrs', 'mobility_telemetry', 'motor_telemetry')
            ORDER BY table_name
            """
            result = conn.execute(text(tables_query))
            existing_tables = [row[0] for row in result.fetchall()]
            expected_tables = ['sols', 'drive_telemetry', 'evrs', 'mobility_telemetry', 'motor_telemetry']
            
            missing_tables = set(expected_tables) - set(existing_tables)
            if missing_tables:
                print(f"❌ Missing tables: {missing_tables}")
                print("   Run the schema.sql script to create tables")
                return False
            else:
                print(f"✅ All required tables exist: {existing_tables}")
                return True
                
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_data_availability():
    """Test if data is available in the database."""
    print("🔍 Testing data availability...")
    
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Check sols table
            result = conn.execute(text("SELECT COUNT(*) FROM sols"))
            sol_count = result.fetchone()[0]
            print(f"📊 Sols in database: {sol_count}")
            
            # Check drive_telemetry table
            result = conn.execute(text("SELECT COUNT(*) FROM drive_telemetry"))
            telemetry_count = result.fetchone()[0]
            print(f"📊 Telemetry points in database: {telemetry_count}")
            
            # Check mobility_telemetry table (optional)
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM mobility_telemetry"))
                mobility_count = result.fetchone()[0]
                print(f"📊 Mobility telemetry points in database: {mobility_count}")
            except:
                print("📊 Mobility telemetry: Not available")
            
            # Check motor_telemetry table (optional)
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM motor_telemetry"))
                motor_count = result.fetchone()[0]
                print(f"📊 Motor telemetry points in database: {motor_count}")
            except:
                print("📊 Motor telemetry: Not available")
            
            # Check EVRs table
            result = conn.execute(text("SELECT COUNT(*) FROM evrs"))
            evr_count = result.fetchone()[0]
            print(f"📊 EVR records in database: {evr_count}")
            
            if sol_count > 0 and telemetry_count > 0:
                print("✅ Data availability check passed")
                return True
            else:
                print("❌ Insufficient data in database")
                return False
                
    except Exception as e:
        print(f"❌ Data availability check failed: {e}")
        return False

def test_api_server():
    """Test API server endpoints."""
    print("🔍 Testing API server...")
    
    try:
        # Test health endpoint
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ API server healthy: {health_data['status']}")
            print(f"   Database connected: {health_data['database_connected']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
        
        # Test sols list endpoint
        response = requests.get(f"{API_BASE_URL}/sols/list", timeout=10)
        if response.status_code == 200:
            sols = response.json()
            print(f"✅ Sols list endpoint: {len(sols)} sols")
            
            if sols:
                # Test individual sol endpoint
                test_sol = sols[0]['sol']
                response = requests.get(f"{API_BASE_URL}/sols/{test_sol}", timeout=10)
                if response.status_code == 200:
                    sol_data = response.json()
                    print(f"✅ Sol detail endpoint: Sol {test_sol} with {len(sol_data.get('telemetry', []))} telemetry points")
                else:
                    print(f"❌ Sol detail failed: {response.status_code}")
                    return False
            
            return True
        else:
            print(f"❌ Sols list failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API server test failed: {e}")
        return False

def test_similarity_search():
    """Test similarity search functionality."""
    print("🔍 Testing similarity search...")
    
    try:
        # Get available sols first
        response = requests.get(f"{API_BASE_URL}/sols/list", timeout=10)
        if response.status_code != 200:
            print("❌ Cannot get sols list for similarity test")
            return False
        
        sols = response.json()
        if len(sols) < 2:
            print("⚠️  Need at least 2 sols for similarity search test")
            return True  # Not a failure, just insufficient data
        
        # Test similarity search with first sol as reference
        reference_sol = sols[0]['sol']
        similarity_request = {
            "reference": {
                "type": "sol",
                "value": reference_sol
            },
            "config": {
                "algorithm": "dtw",
                "variables": ["elevation"],
                "max_results": 3
            }
        }
        
        response = requests.post(
            f"{API_BASE_URL}/query/similar",
            json=similarity_request,
            timeout=30
        )
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ DTW similarity search: {results['total_results']} results")
            for result in results['results'][:2]:
                print(f"   Sol {result['sol']}: {result['similarity_score']:.3f}")
        else:
            print(f"❌ DTW similarity search failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
        # Test k-NN similarity search
        knn_request = {
            "reference": {
                "type": "sol",
                "value": reference_sol
            },
            "config": {
                "algorithm": "knn",
                "variables": ["elevation", "slip"],
                "max_results": 3
            }
        }
        
        response = requests.post(
            f"{API_BASE_URL}/query/similar",
            json=knn_request,
            timeout=30
        )
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ k-NN similarity search: {results['total_results']} results")
            for result in results['results'][:2]:
                print(f"   Sol {result['sol']}: {result['similarity_score']:.3f}")
        else:
            print(f"❌ k-NN similarity search failed: {response.status_code}")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Similarity search test failed: {e}")
        return False

def test_explicit_query():
    """Test explicit database query functionality."""
    print("\n🔍 Testing explicit query...")
    
    try:
        # Test simple filter query
        query_request = {
            "filters": [
                {
                    "field": "distance",
                    "operator": "gt",
                    "value": 0.0
                }
            ],
            "limit": 5,
            "order_by": "sol",
            "order_desc": False
        }
        
        response = requests.post(
            f"{API_BASE_URL}/query/explicit",
            json=query_request,
            timeout=10
        )
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Explicit query: {len(results)} results")
            if results:
                print(f"   First result: Sol {results[0]['sol']}")
        else:
            print(f"❌ Explicit query failed: {response.status_code}")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Explicit query test failed: {e}")
        return False

def test_telemetry_apis():
    """Test the new telemetry API endpoints."""
    print("\n🔍 Testing telemetry APIs...")
    
    try:
        # Test motor list endpoint
        response = requests.get(f"{API_BASE_URL}/telemetry/motors/list", timeout=10)
        if response.status_code == 200:
            motor_data = response.json()
            print(f"✅ Motor list endpoint: {motor_data['total_count']} motors")
            print(f"   Available motors: {', '.join(motor_data['motors'][:3])}...")
        else:
            print(f"❌ Motor list failed: {response.status_code}")
            return False
        
        # Test mobility telemetry endpoint
        response = requests.get(
            f"{API_BASE_URL}/telemetry/mobility?start_sclk=759350000&end_sclk=759351000",
            timeout=10
        )
        if response.status_code == 200:
            mobility_data = response.json()
            print(f"✅ Mobility telemetry endpoint: {mobility_data['point_count']} points")
            if mobility_data['telemetry']:
                first_point = mobility_data['telemetry'][0]
                print(f"   Sample data: SCLK {first_point['sclk']}, bogie_l={first_point['bogie_l']}")
        else:
            print(f"❌ Mobility telemetry failed: {response.status_code}")
            return False
        
        # Test motor telemetry endpoint (single motor)
        response = requests.get(
            f"{API_BASE_URL}/telemetry/motors?start_sclk=759350000&end_sclk=759351000&motors=DRIVE_LF",
            timeout=10
        )
        if response.status_code == 200:
            motor_data = response.json()
            print(f"✅ Motor telemetry endpoint (single): {motor_data['point_count']} points")
            if motor_data['motors'] and 'DRIVE_LF' in motor_data['motors']:
                drive_lf_points = motor_data['motors']['DRIVE_LF']
                if drive_lf_points:
                    first_point = drive_lf_points[0]
                    print(f"   Sample DRIVE_LF: SCLK {first_point['sclk']}, odom={first_point['odom']}")
        else:
            print(f"❌ Motor telemetry (single) failed: {response.status_code}")
            return False
        
        # Test motor telemetry endpoint (multiple motors)
        response = requests.get(
            f"{API_BASE_URL}/telemetry/motors?start_sclk=759350000&end_sclk=759351000&motors=DRIVE_LF,STEER_LF",
            timeout=10
        )
        if response.status_code == 200:
            motor_data = response.json()
            print(f"✅ Motor telemetry endpoint (multiple): {motor_data['point_count']} points")
            motor_count = len(motor_data['motors'])
            print(f"   Motors returned: {motor_count}")
        else:
            print(f"❌ Motor telemetry (multiple) failed: {response.status_code}")
            return False
        
        # Test motor telemetry endpoint (all motors)
        response = requests.get(
            f"{API_BASE_URL}/telemetry/motors?start_sclk=759350000&end_sclk=759351000",
            timeout=10
        )
        if response.status_code == 200:
            motor_data = response.json()
            print(f"✅ Motor telemetry endpoint (all): {motor_data['point_count']} points")
            motor_count = len(motor_data['motors'])
            print(f"   Motors returned: {motor_count}")
        else:
            print(f"❌ Motor telemetry (all) failed: {response.status_code}")
            return False
        
        # Test segment validation endpoint
        response = requests.get(
            f"{API_BASE_URL}/telemetry/segments/validate?start_sclk=759350000&end_sclk=759351000",
            timeout=10
        )
        if response.status_code == 200:
            validation_data = response.json()
            print(f"✅ Segment validation endpoint: valid={validation_data['valid']}")
            if validation_data['valid']:
                print(f"   Duration: {validation_data['duration']:.1f}s, Points: {validation_data['point_count']}")
        else:
            print(f"❌ Segment validation failed: {response.status_code}")
            return False
        
        # Test nearest SCLK endpoint
        response = requests.get(
            f"{API_BASE_URL}/telemetry/nearest?easting=4348232&northing=1096136",
            timeout=10
        )
        if response.status_code == 200:
            nearest_data = response.json()
            print(f"✅ Nearest SCLK endpoint: SCLK {nearest_data['sclk']}")
            print(f"   Distance: {nearest_data['distance']:.2f}m")
        else:
            print(f"❌ Nearest SCLK failed: {response.status_code}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Telemetry APIs test failed: {e}")
        return False

def run_ingestion_test():
    """Run a quick ingestion test."""
    print("\n🔍 Testing data ingestion...")
    
    try:
        ingestion_dir = Path(__file__).parent / "ingestion"
        
        # Check if ingestion environment exists
        if not (ingestion_dir / "venv").exists():
            print("⚠️  Ingestion virtual environment not found")
            print("   Create it: cd ingestion && python -m venv venv && pip install -r requirements.txt")
            return False
            
        # Test configuration check
        result = subprocess.run([
            str(ingestion_dir / "venv" / "bin" / "python"),
            str(ingestion_dir / "ingest.py"),
            "--config-check"
        ], capture_output=True, text=True, cwd=ingestion_dir)
        
        if result.returncode == 0:
            print("✅ Ingestion pipeline configuration OK")
            return True
        else:
            print(f"❌ Ingestion pipeline config check failed:")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Ingestion test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Hindsight System Test")
    print("=" * 50)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Data Availability", test_data_availability),
        ("API Server", test_api_server),
        ("Similarity Search", test_similarity_search),
        ("Explicit Query", test_explicit_query),
        ("Ingestion Pipeline", run_ingestion_test),
        ("Telemetry APIs", test_telemetry_apis),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = False
        
        time.sleep(1)  # Small delay between tests
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 Test Summary:")
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All systems operational!")
        return 0
    else:
        print("⚠️  Some systems need attention")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 