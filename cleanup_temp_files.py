#!/usr/bin/env python3
"""Clean up temporary test files"""
import os

files_to_remove = [
    'query_white_openings.py',
    'debug_caro_kann.py',
    'test_filter.py',
    'test_caro_kann_filter.py'
]

for file in files_to_remove:
    if os.path.exists(file):
        os.remove(file)
        print(f"Removed {file}")
    else:
        print(f"{file} not found")
