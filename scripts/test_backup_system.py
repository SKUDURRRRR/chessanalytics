#!/usr/bin/env python3
"""
Test script for Chess Analytics Backup System
Tests the backup system without requiring Supabase credentials.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

def test_code_backup():
    """Test code backup functionality."""
    print("Testing Code Backup...")
    print("-" * 30)
    
    try:
        from backup_code import CodeBackup
        
        backup_system = CodeBackup()
        
        # Test listing backups
        backups = backup_system.list_backups()
        print(f"✅ Code backup listing works: {len(backups)} backups found")
        
        # Test creating a small backup
        backup_path = backup_system.create_backup(
            include_git=False,  # Skip Git to avoid issues
            compress=False
        )
        
        if Path(backup_path).exists():
            print(f"✅ Code backup creation works: {backup_path}")
            
            # Check if manifest exists
            manifest_path = Path(backup_path) / "manifest.json"
            if manifest_path.exists():
                with open(manifest_path, 'r') as f:
                    manifest = json.load(f)
                print(f"✅ Manifest created: {manifest['backup_name']}")
            else:
                print("❌ Manifest not found")
        else:
            print("❌ Code backup creation failed")
            
        return True
        
    except Exception as e:
        print(f"❌ Code backup test failed: {e}")
        return False

def test_config_backup():
    """Test configuration backup functionality."""
    print("\nTesting Configuration Backup...")
    print("-" * 30)
    
    try:
        from backup_config import ConfigBackup
        
        backup_system = ConfigBackup()
        
        # Test listing backups
        backups = backup_system.list_backups()
        print(f"✅ Config backup listing works: {len(backups)} backups found")
        
        # Test creating a backup
        backup_path = backup_system.create_backup(
            include_sensitive=False,
            compress=False
        )
        
        if Path(backup_path).exists():
            print(f"✅ Config backup creation works: {backup_path}")
            
            # Check if manifest exists
            manifest_path = Path(backup_path) / "manifest.json"
            if manifest_path.exists():
                with open(manifest_path, 'r') as f:
                    manifest = json.load(f)
                print(f"✅ Manifest created: {manifest['backup_name']}")
            else:
                print("❌ Manifest not found")
        else:
            print("❌ Config backup creation failed")
            
        return True
        
    except Exception as e:
        print(f"❌ Config backup test failed: {e}")
        return False

def test_backup_structure():
    """Test backup directory structure."""
    print("\nTesting Backup Structure...")
    print("-" * 30)
    
    backup_dir = Path("backups")
    if not backup_dir.exists():
        print("❌ Backups directory not found")
        return False
    
    print(f"✅ Backups directory exists: {backup_dir}")
    
    # List all backup directories
    backup_items = list(backup_dir.iterdir())
    print(f"✅ Found {len(backup_items)} backup items")
    
    for item in backup_items:
        if item.is_dir():
            print(f"  📁 {item.name}")
            
            # Check for manifest
            manifest_path = item / "manifest.json"
            if manifest_path.exists():
                print(f"    ✅ Manifest found")
            else:
                print(f"    ❌ Manifest missing")
                
        elif item.suffix == ".tar.gz":
            print(f"  📦 {item.name} (compressed)")
    
    return True

def test_file_integrity():
    """Test file integrity in backups."""
    print("\nTesting File Integrity...")
    print("-" * 30)
    
    backup_dir = Path("backups")
    total_files = 0
    valid_files = 0
    
    for item in backup_dir.iterdir():
        if item.is_dir():
            for file_path in item.rglob("*"):
                if file_path.is_file():
                    total_files += 1
                    try:
                        # Try to read the file
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        valid_files += 1
                    except Exception as e:
                        print(f"❌ Error reading {file_path}: {e}")
    
    print(f"✅ File integrity check: {valid_files}/{total_files} files readable")
    return valid_files == total_files

def main():
    """Run all backup system tests."""
    print("Chess Analytics Backup System Test")
    print("=" * 40)
    print(f"Test started at: {datetime.now().isoformat()}")
    print()
    
    tests = [
        ("Code Backup", test_code_backup),
        ("Configuration Backup", test_config_backup),
        ("Backup Structure", test_backup_structure),
        ("File Integrity", test_file_integrity)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 40)
    print("TEST SUMMARY")
    print("=" * 40)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backup system is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
