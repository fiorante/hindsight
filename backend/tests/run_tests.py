#!/usr/bin/env python3
"""
Test runner script for the Hindsight Backend API.
"""

import sys
import subprocess
import os
from pathlib import Path

def run_tests():
    """Run the test suite with coverage reporting."""
    
    # Get the directory containing this script
    test_dir = Path(__file__).parent
    backend_dir = test_dir.parent
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Run pytest with coverage
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/",
        "-v",
        "--cov=.",
        "--cov-report=html:tests/coverage_html",
        "--cov-report=term-missing",
        "--tb=short"
    ]
    
    print("🧪 Running backend tests...")
    print(f"Command: {' '.join(cmd)}")
    print()
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n✅ All tests passed!")
        print("📊 Coverage report generated in tests/coverage_html/")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Tests failed with exit code {e.returncode}")
        return e.returncode

def run_specific_test(test_file):
    """Run a specific test file."""
    
    test_dir = Path(__file__).parent
    backend_dir = test_dir.parent
    os.chdir(backend_dir)
    
    cmd = [
        sys.executable, "-m", "pytest",
        f"tests/{test_file}",
        "-v",
        "--tb=short"
    ]
    
    print(f"🧪 Running specific test: {test_file}")
    print(f"Command: {' '.join(cmd)}")
    print()
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n✅ Test passed!")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Test failed with exit code {e.returncode}")
        return e.returncode

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run specific test file
        test_file = sys.argv[1]
        exit_code = run_specific_test(test_file)
    else:
        # Run all tests
        exit_code = run_tests()
    
    sys.exit(exit_code)
