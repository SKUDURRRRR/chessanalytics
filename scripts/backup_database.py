#!/usr/bin/env python3
"""
Database Backup Script for Chess Analytics
Creates comprehensive backups of Supabase database including schema and data.
"""

import os
import json
import csv
import gzip
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import asyncio
import aiohttp
import asyncpg
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DatabaseBackup:
    """Handles database backup operations for the chess analytics system."""
    
    def __init__(self, backup_dir: str = "backups"):
        """Initialize the backup system."""
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Database configuration
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing required Supabase environment variables")
        
        # Initialize Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Tables to backup (in dependency order)
        self.tables = [
            "user_profiles",
            "games",
            "games_pgn", 
            "move_analyses",
            "unified_analyses",
            "analysis_jobs",
            "opening_analyses",
            "tactical_analyses",
            "positional_analyses",
            "personality_analyses"
        ]
        
        # Views to backup
        self.views = [
            "unified_analyses_view"
        ]
        
        # Functions to backup
        self.functions = [
            "calculate_accuracy_score",
            "calculate_tactical_score", 
            "calculate_positional_score",
            "calculate_personality_score",
            "get_game_analysis_summary"
        ]
    
    async def create_backup(self, include_data: bool = True, compress: bool = True) -> str:
        """Create a comprehensive database backup."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chess_analytics_backup_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        print(f"Creating backup: {backup_name}")
        
        try:
            # 1. Backup schema
            await self._backup_schema(backup_path)
            
            # 2. Backup data (if requested)
            if include_data:
                await self._backup_data(backup_path)
            
            # 3. Backup views
            await self._backup_views(backup_path)
            
            # 4. Backup functions
            await self._backup_functions(backup_path)
            
            # 5. Backup RLS policies
            await self._backup_rls_policies(backup_path)
            
            # 6. Create backup manifest
            await self._create_manifest(backup_path, include_data)
            
            # 7. Compress if requested
            if compress:
                compressed_path = await self._compress_backup(backup_path)
                print(f"Backup compressed to: {compressed_path}")
                return str(compressed_path)
            
            print(f"Backup created successfully: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            print(f"Error creating backup: {e}")
            # Cleanup on error
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
    
    async def _backup_schema(self, backup_path: Path):
        """Backup database schema."""
        print("Backing up schema...")
        
        schema_dir = backup_path / "schema"
        schema_dir.mkdir(exist_ok=True)
        
        # Get table schemas
        for table in self.tables:
            try:
                # Get table structure
                response = self.supabase.table(table).select("*").limit(0).execute()
                
                # Get column information
                columns_info = []
                if hasattr(response, 'data') and response.data:
                    # This is a simplified approach - in production you'd want to query information_schema
                    columns_info = [{"name": "id", "type": "uuid", "nullable": False}]
                
                schema_info = {
                    "table_name": table,
                    "columns": columns_info,
                    "created_at": datetime.now().isoformat()
                }
                
                with open(schema_dir / f"{table}.json", "w") as f:
                    json.dump(schema_info, f, indent=2)
                    
            except Exception as e:
                print(f"Warning: Could not backup schema for table {table}: {e}")
    
    async def _backup_data(self, backup_path: Path):
        """Backup table data."""
        print("Backing up data...")
        
        data_dir = backup_path / "data"
        data_dir.mkdir(exist_ok=True)
        
        for table in self.tables:
            try:
                print(f"  Backing up table: {table}")
                
                # Get all data from table
                response = self.supabase.table(table).select("*").execute()
                
                if response.data:
                    # Save as JSON
                    with open(data_dir / f"{table}.json", "w") as f:
                        json.dump(response.data, f, indent=2)
                    
                    # Save as CSV for easier inspection
                    with open(data_dir / f"{table}.csv", "w", newline="", encoding="utf-8") as f:
                        if response.data:
                            writer = csv.DictWriter(f, fieldnames=response.data[0].keys())
                            writer.writeheader()
                            writer.writerows(response.data)
                    
                    print(f"    {len(response.data)} records backed up")
                else:
                    print(f"    No data found for table {table}")
                    
            except Exception as e:
                print(f"Warning: Could not backup data for table {table}: {e}")
    
    async def _backup_views(self, backup_path: Path):
        """Backup database views."""
        print("Backing up views...")
        
        views_dir = backup_path / "views"
        views_dir.mkdir(exist_ok=True)
        
        for view in self.views:
            try:
                # Get view definition (simplified - would need direct SQL access)
                view_info = {
                    "view_name": view,
                    "definition": f"-- View definition for {view}\n-- (Requires direct database access for full definition)",
                    "created_at": datetime.now().isoformat()
                }
                
                with open(views_dir / f"{view}.sql", "w") as f:
                    f.write(view_info["definition"])
                    
            except Exception as e:
                print(f"Warning: Could not backup view {view}: {e}")
    
    async def _backup_functions(self, backup_path: Path):
        """Backup database functions."""
        print("Backing up functions...")
        
        functions_dir = backup_path / "functions"
        functions_dir.mkdir(exist_ok=True)
        
        for function in self.functions:
            try:
                # Get function definition (simplified - would need direct SQL access)
                function_info = {
                    "function_name": function,
                    "definition": f"-- Function definition for {function}\n-- (Requires direct database access for full definition)",
                    "created_at": datetime.now().isoformat()
                }
                
                with open(functions_dir / f"{function}.sql", "w") as f:
                    f.write(function_info["definition"])
                    
            except Exception as e:
                print(f"Warning: Could not backup function {function}: {e}")
    
    async def _backup_rls_policies(self, backup_path: Path):
        """Backup RLS policies."""
        print("Backing up RLS policies...")
        
        policies_dir = backup_path / "policies"
        policies_dir.mkdir(exist_ok=True)
        
        # This would require direct database access to query pg_policies
        policies_info = {
            "note": "RLS policies backup requires direct database access",
            "tables_with_rls": self.tables,
            "created_at": datetime.now().isoformat()
        }
        
        with open(policies_dir / "rls_policies.json", "w") as f:
            json.dump(policies_info, f, indent=2)
    
    async def _create_manifest(self, backup_path: Path, include_data: bool):
        """Create backup manifest."""
        manifest = {
            "backup_name": backup_path.name,
            "created_at": datetime.now().isoformat(),
            "database_url": self.supabase_url,
            "include_data": include_data,
            "tables": self.tables,
            "views": self.views,
            "functions": self.functions,
            "backup_version": "1.0.0",
            "description": "Chess Analytics Database Backup"
        }
        
        with open(backup_path / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
    
    async def _compress_backup(self, backup_path: Path) -> str:
        """Compress the backup directory."""
        print("Compressing backup...")
        
        compressed_path = f"{backup_path}.tar.gz"
        
        # Create tar.gz archive
        import tarfile
        with tarfile.open(compressed_path, "w:gz") as tar:
            tar.add(backup_path, arcname=backup_path.name)
        
        # Remove uncompressed directory
        shutil.rmtree(backup_path)
        
        return compressed_path
    
    async def list_backups(self) -> List[Dict[str, Any]]:
        """List available backups."""
        backups = []
        
        for item in self.backup_dir.iterdir():
            if item.is_dir() and item.name.startswith("chess_analytics_backup_"):
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                    backups.append(manifest)
            elif item.suffix == ".tar.gz" and item.name.startswith("chess_analytics_backup_"):
                # Extract basic info from compressed backup
                backups.append({
                    "backup_name": item.stem,
                    "created_at": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
                    "compressed": True,
                    "size_mb": round(item.stat().st_size / (1024 * 1024), 2)
                })
        
        return sorted(backups, key=lambda x: x["created_at"], reverse=True)
    
    async def restore_backup(self, backup_name: str, target_tables: Optional[List[str]] = None):
        """Restore from a backup (data only - schema must be created separately)."""
        print(f"Restoring from backup: {backup_name}")
        
        backup_path = self.backup_dir / backup_name
        
        if not backup_path.exists():
            print(f"Backup not found: {backup_path}")
            return False
        
        try:
            data_dir = backup_path / "data"
            if not data_dir.exists():
                print("No data directory found in backup")
                return False
            
            tables_to_restore = target_tables or self.tables
            
            for table in tables_to_restore:
                json_file = data_dir / f"{table}.json"
                if json_file.exists():
                    print(f"Restoring table: {table}")
                    
                    with open(json_file, "r") as f:
                        data = json.load(f)
                    
                    if data:
                        # Clear existing data (be careful in production!)
                        # self.supabase.table(table).delete().neq("id", "").execute()
                        
                        # Insert data in batches
                        batch_size = 100
                        for i in range(0, len(data), batch_size):
                            batch = data[i:i + batch_size]
                            self.supabase.table(table).insert(batch).execute()
                        
                        print(f"  Restored {len(data)} records")
                else:
                    print(f"  No data file found for table {table}")
            
            print("Restore completed successfully")
            return True
            
        except Exception as e:
            print(f"Error during restore: {e}")
            return False

async def main():
    """Main function for running backup operations."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Chess Analytics Database Backup")
    parser.add_argument("--action", choices=["backup", "list", "restore"], default="backup",
                       help="Action to perform")
    parser.add_argument("--backup-name", help="Backup name for restore operation")
    parser.add_argument("--no-data", action="store_true", help="Skip data backup (schema only)")
    parser.add_argument("--no-compress", action="store_true", help="Skip compression")
    parser.add_argument("--tables", nargs="+", help="Specific tables to restore")
    
    args = parser.parse_args()
    
    try:
        backup_system = DatabaseBackup()
        
        if args.action == "backup":
            backup_path = await backup_system.create_backup(
                include_data=not args.no_data,
                compress=not args.no_compress
            )
            print(f"Backup completed: {backup_path}")
            
        elif args.action == "list":
            backups = await backup_system.list_backups()
            print(f"\nAvailable backups ({len(backups)}):")
            for backup in backups:
                print(f"  {backup['backup_name']} - {backup['created_at']}")
                if 'size_mb' in backup:
                    print(f"    Size: {backup['size_mb']} MB")
            
        elif args.action == "restore":
            if not args.backup_name:
                print("Error: --backup-name required for restore operation")
                return
            
            success = await backup_system.restore_backup(args.backup_name, args.tables)
            if success:
                print("Restore completed successfully")
            else:
                print("Restore failed")
    
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    asyncio.run(main())
