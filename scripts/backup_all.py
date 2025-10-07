#!/usr/bin/env python3
"""
Comprehensive Backup Script for Chess Analytics
Creates complete backups of code, database, configurations, and all project components.
"""

import os
import json
import shutil
import tarfile
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse
import sys

# Import our backup modules
from backup_database import DatabaseBackup
from backup_code import CodeBackup
from backup_config import ConfigBackup

class ComprehensiveBackup:
    """Handles comprehensive backup operations for the chess analytics system."""
    
    def __init__(self, project_root: str = ".", backup_dir: str = "backups"):
        """Initialize the comprehensive backup system."""
        self.project_root = Path(project_root).resolve()
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Initialize individual backup systems
        self.db_backup = DatabaseBackup(backup_dir=str(self.backup_dir))
        self.code_backup = CodeBackup(project_root=str(self.project_root), backup_dir=str(self.backup_dir))
        self.config_backup = ConfigBackup(project_root=str(self.project_root), backup_dir=str(self.backup_dir))
    
    async def create_full_backup(self, 
                                include_data: bool = True,
                                include_sensitive: bool = False,
                                include_git: bool = True,
                                compress: bool = True) -> str:
        """Create a comprehensive backup of all components."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chess_analytics_full_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        print(f"Creating comprehensive backup: {backup_name}")
        print("=" * 60)
        
        try:
            # 1. Database backup
            print("\n1. DATABASE BACKUP")
            print("-" * 20)
            db_backup_path = await self.db_backup.create_backup(
                include_data=include_data,
                compress=False  # We'll compress everything together
            )
            self._move_to_full_backup(db_backup_path, backup_path / "database")
            print("✅ Database backup completed")
            
            # 2. Code backup
            print("\n2. CODE BACKUP")
            print("-" * 20)
            code_backup_path = self.code_backup.create_backup(
                include_git=include_git,
                compress=False  # We'll compress everything together
            )
            self._move_to_full_backup(code_backup_path, backup_path / "code")
            print("✅ Code backup completed")
            
            # 3. Configuration backup
            print("\n3. CONFIGURATION BACKUP")
            print("-" * 20)
            config_backup_path = self.config_backup.create_backup(
                include_sensitive=include_sensitive,
                compress=False  # We'll compress everything together
            )
            self._move_to_full_backup(config_backup_path, backup_path / "configurations")
            print("✅ Configuration backup completed")
            
            # 4. Create comprehensive manifest
            print("\n4. CREATING MANIFEST")
            print("-" * 20)
            await self._create_comprehensive_manifest(backup_path, {
                "include_data": include_data,
                "include_sensitive": include_sensitive,
                "include_git": include_git
            })
            print("✅ Comprehensive manifest created")
            
            # 5. Create restoration guide
            print("\n5. CREATING RESTORATION GUIDE")
            print("-" * 20)
            self._create_restoration_guide(backup_path)
            print("✅ Restoration guide created")
            
            # 6. Compress if requested
            if compress:
                print("\n6. COMPRESSING BACKUP")
                print("-" * 20)
                compressed_path = self._compress_backup(backup_path)
                print(f"✅ Backup compressed to: {compressed_path}")
                return str(compressed_path)
            
            print(f"\n✅ Comprehensive backup created successfully: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            print(f"\n❌ Error creating comprehensive backup: {e}")
            # Cleanup on error
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
    
    def _move_to_full_backup(self, source_path: str, dest_dir: Path):
        """Move individual backup to comprehensive backup directory."""
        source = Path(source_path)
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        if source.is_dir():
            # Move directory contents
            for item in source.iterdir():
                dest_item = dest_dir / item.name
                if item.is_dir():
                    shutil.copytree(item, dest_item)
                else:
                    shutil.copy2(item, dest_item)
            # Remove source directory
            shutil.rmtree(source)
        else:
            # Move file
            shutil.move(source, dest_dir / source.name)
    
    async def _create_comprehensive_manifest(self, backup_path: Path, options: Dict[str, Any]):
        """Create comprehensive backup manifest."""
        manifest = {
            "backup_name": backup_path.name,
            "backup_type": "comprehensive",
            "created_at": datetime.now().isoformat(),
            "project_root": str(self.project_root),
            "backup_version": "1.0.0",
            "description": "Chess Analytics Comprehensive Backup",
            "options": options,
            "components": {
                "database": {
                    "included": True,
                    "include_data": options["include_data"],
                    "description": "Database schema and data backup"
                },
                "code": {
                    "included": True,
                    "include_git": options["include_git"],
                    "description": "Source code and project files backup"
                },
                "configurations": {
                    "included": True,
                    "include_sensitive": options["include_sensitive"],
                    "description": "Configuration files and environment backup"
                }
            },
            "restoration_instructions": {
                "database": "Use the database backup to restore schema and data",
                "code": "Extract code backup to restore source files",
                "configurations": "Use configuration backup to restore settings and environment"
            },
            "file_structure": {
                "database/": "Database backup files",
                "code/": "Source code backup files", 
                "configurations/": "Configuration backup files",
                "manifest.json": "This manifest file",
                "RESTORATION_GUIDE.md": "Step-by-step restoration instructions"
            }
        }
        
        with open(backup_path / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
    
    def _create_restoration_guide(self, backup_path: Path):
        """Create comprehensive restoration guide."""
        guide_content = """# Chess Analytics Restoration Guide

This guide will help you restore your Chess Analytics project from a comprehensive backup.

## Prerequisites

Before starting the restoration process, ensure you have:

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Supabase account and project
- Stockfish engine
- Git (if restoring Git history)

## Restoration Steps

### 1. Extract the Backup

If the backup is compressed:
```bash
tar -xzf chess_analytics_full_YYYYMMDD_HHMMSS.tar.gz
cd chess_analytics_full_YYYYMMDD_HHMMSS
```

### 2. Restore Database

1. Set up your Supabase project
2. Run the database migrations:
   ```bash
   supabase db push
   ```
3. If data backup is included, restore the data:
   ```bash
   python scripts/backup_database.py --action restore --backup-name database
   ```

### 3. Restore Code

1. Copy the code files to your project directory:
   ```bash
   cp -r code/* /path/to/your/project/
   ```
2. Install dependencies:
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies
   pip install -r requirements.txt
   ```

### 4. Restore Configurations

1. Copy configuration files:
   ```bash
   cp -r configurations/* /path/to/your/project/
   ```
2. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

### 5. Set Up Stockfish

1. Download Stockfish engine
2. Update the path in your configuration
3. Test the engine:
   ```bash
   python -c "import stockfish; print('Stockfish OK')"
   ```

### 6. Verify Installation

1. Start the backend:
   ```bash
   python python/main.py
   ```
2. Start the frontend:
   ```bash
   npm run dev
   ```
3. Test the application in your browser

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify Supabase credentials in .env
   - Check if database migrations are up to date

2. **Stockfish Not Found**
   - Verify Stockfish path in configuration
   - Ensure Stockfish executable has proper permissions

3. **Missing Dependencies**
   - Run `npm install` and `pip install -r requirements.txt`
   - Check Python and Node.js versions

4. **Environment Variables**
   - Ensure all required environment variables are set
   - Check .env file format and syntax

### Getting Help

If you encounter issues:

1. Check the logs for error messages
2. Verify all prerequisites are installed
3. Ensure all configuration files are properly set up
4. Test each component individually

## Backup Information

- **Backup Created**: {backup_date}
- **Project Root**: {project_root}
- **Components Included**: Database, Code, Configurations
- **Git History**: {git_included}

## Security Notes

- Never commit sensitive environment variables to version control
- Use strong passwords for database access
- Regularly update dependencies for security patches
- Keep backups in a secure location

---

For more detailed information, refer to the individual component manifests in each backup directory.
""".format(
            backup_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            project_root=str(self.project_root),
            git_included="Yes" if True else "No"  # This would be dynamic in real usage
        )
        
        with open(backup_path / "RESTORATION_GUIDE.md", "w") as f:
            f.write(guide_content)
    
    def _compress_backup(self, backup_path: Path) -> str:
        """Compress the comprehensive backup."""
        compressed_path = f"{backup_path}.tar.gz"
        
        with tarfile.open(compressed_path, "w:gz") as tar:
            tar.add(backup_path, arcname=backup_path.name)
        
        # Remove uncompressed directory
        shutil.rmtree(backup_path)
        
        return compressed_path
    
    async def create_quick_backup(self, compress: bool = True) -> str:
        """Create a quick backup (code and config only, no database)."""
        print("Creating quick backup (code and configurations only)...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chess_analytics_quick_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        try:
            # Code backup
            code_backup_path = self.code_backup.create_backup(
                include_git=True,
                compress=False
            )
            self._move_to_full_backup(code_backup_path, backup_path / "code")
            
            # Configuration backup
            config_backup_path = self.config_backup.create_backup(
                include_sensitive=False,
                compress=False
            )
            self._move_to_full_backup(config_backup_path, backup_path / "configurations")
            
            # Create manifest
            manifest = {
                "backup_name": backup_name,
                "backup_type": "quick",
                "created_at": datetime.now().isoformat(),
                "description": "Chess Analytics Quick Backup (Code + Config)",
                "components": ["code", "configurations"],
                "note": "Database not included in quick backup"
            }
            
            with open(backup_path / "manifest.json", "w") as f:
                json.dump(manifest, f, indent=2)
            
            if compress:
                compressed_path = self._compress_backup(backup_path)
                print(f"Quick backup compressed to: {compressed_path}")
                return str(compressed_path)
            
            print(f"Quick backup created: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            print(f"Error creating quick backup: {e}")
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List all available backups."""
        all_backups = []
        
        # Get database backups
        try:
            db_backups = asyncio.run(self.db_backup.list_backups())
            for backup in db_backups:
                backup["type"] = "database"
            all_backups.extend(db_backups)
        except:
            pass
        
        # Get code backups
        try:
            code_backups = self.code_backup.list_backups()
            for backup in code_backups:
                backup["type"] = "code"
            all_backups.extend(code_backups)
        except:
            pass
        
        # Get config backups
        try:
            config_backups = self.config_backup.list_backups()
            for backup in config_backups:
                backup["type"] = "config"
            all_backups.extend(config_backups)
        except:
            pass
        
        # Get comprehensive backups
        for item in self.backup_dir.iterdir():
            if item.is_dir() and item.name.startswith("chess_analytics_full_"):
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                    manifest["type"] = "comprehensive"
                    all_backups.append(manifest)
            elif item.suffix == ".tar.gz" and item.name.startswith("chess_analytics_full_"):
                all_backups.append({
                    "backup_name": item.stem,
                    "created_at": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
                    "compressed": True,
                    "size_mb": round(item.stat().st_size / (1024 * 1024), 2),
                    "type": "comprehensive"
                })
        
        return sorted(all_backups, key=lambda x: x["created_at"], reverse=True)

async def main():
    """Main function for running comprehensive backup operations."""
    parser = argparse.ArgumentParser(description="Chess Analytics Comprehensive Backup")
    parser.add_argument("--action", 
                       choices=["backup", "quick-backup", "list"], 
                       default="backup",
                       help="Action to perform")
    parser.add_argument("--no-data", action="store_true", 
                       help="Skip database data backup (schema only)")
    parser.add_argument("--include-sensitive", action="store_true",
                       help="Include sensitive environment variables")
    parser.add_argument("--no-git", action="store_true",
                       help="Skip Git repository backup")
    parser.add_argument("--no-compress", action="store_true",
                       help="Skip compression")
    parser.add_argument("--project-root", default=".", 
                       help="Project root directory")
    
    args = parser.parse_args()
    
    try:
        backup_system = ComprehensiveBackup(project_root=args.project_root)
        
        if args.action == "backup":
            backup_path = await backup_system.create_full_backup(
                include_data=not args.no_data,
                include_sensitive=args.include_sensitive,
                include_git=not args.no_git,
                compress=not args.no_compress
            )
            print(f"\n🎉 Comprehensive backup completed: {backup_path}")
            
        elif args.action == "quick-backup":
            backup_path = await backup_system.create_quick_backup(
                compress=not args.no_compress
            )
            print(f"\n🎉 Quick backup completed: {backup_path}")
            
        elif args.action == "list":
            backups = backup_system.list_backups()
            print(f"\nAvailable backups ({len(backups)}):")
            print("=" * 80)
            
            for backup in backups:
                backup_type = backup.get("type", "unknown")
                size_info = f" - {backup.get('size_mb', 0)} MB" if 'size_mb' in backup else ""
                compressed_info = " (compressed)" if backup.get("compressed") else ""
                
                print(f"📦 {backup['backup_name']} [{backup_type}]{compressed_info}")
                print(f"   Created: {backup['created_at']}{size_info}")
                
                if backup_type == "comprehensive":
                    components = backup.get("components", {})
                    comp_list = [k for k, v in components.items() if v.get("included")]
                    print(f"   Components: {', '.join(comp_list)}")
                
                print()
    
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
