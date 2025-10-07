#!/usr/bin/env python3
"""
Configuration Backup Script for Chess Analytics
Creates comprehensive backups of all configurations, environment variables, and settings.
"""

import os
import json
import shutil
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import subprocess
import sys
from dotenv import load_dotenv

class ConfigBackup:
    """Handles configuration backup operations for the chess analytics system."""
    
    def __init__(self, project_root: str = ".", backup_dir: str = "backups"):
        """Initialize the configuration backup system."""
        self.project_root = Path(project_root).resolve()
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Load environment variables
        load_dotenv()
        
        # Configuration files to backup
        self.config_files = [
            "package.json",
            "package-lock.json",
            "requirements.txt",
            "tsconfig.json",
            "tsconfig.node.json",
            "vite.config.ts",
            "tailwind.config.js",
            "postcss.config.js",
            "playwright.config.ts",
            "vitest.config.ts",
            "typedoc.json",
            "vercel.json",
            "docker-compose.api.yml",
            "Dockerfile.api",
            "example_config.json",
            "env.example",
            "tailwind.config.js",
            "postcss.config.js",
            "playwright.config.ts",
            "vitest.config.ts"
        ]
        
        # Environment files to backup (without sensitive data)
        self.env_files = [
            "env.example",
            ".env.example"
        ]
        
        # Documentation files
        self.doc_files = [
            "README.md",
            "QUICK_START.md",
            "DEPLOYMENT_SETUP.md",
            "PRODUCTION_DEPLOYMENT_GUIDE.md",
            "SECURITY_NOTES.md",
            "*.md"
        ]
        
        # Script files
        self.script_files = [
            "start-all.ps1",
            "start-backend.ps1",
            "start-backend.bat",
            "stop-all.ps1",
            "scripts/**/*.py",
            "scripts/**/*.ps1",
            "scripts/**/*.bat",
            "scripts/**/*.sh"
        ]
    
    def create_backup(self, include_sensitive: bool = False, compress: bool = True) -> str:
        """Create a comprehensive configuration backup."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chess_analytics_config_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        print(f"Creating configuration backup: {backup_name}")
        
        try:
            # 1. Backup configuration files
            self._backup_config_files(backup_path)
            
            # 2. Backup environment configuration
            self._backup_environment_config(backup_path, include_sensitive)
            
            # 3. Backup system configuration
            self._backup_system_config(backup_path)
            
            # 4. Backup deployment configuration
            self._backup_deployment_config(backup_path)
            
            # 5. Backup documentation
            self._backup_documentation(backup_path)
            
            # 6. Backup scripts
            self._backup_scripts(backup_path)
            
            # 7. Create configuration manifest
            self._create_config_manifest(backup_path, include_sensitive)
            
            # 8. Compress if requested
            if compress:
                compressed_path = self._compress_backup(backup_path)
                print(f"Configuration backup compressed to: {compressed_path}")
                return str(compressed_path)
            
            print(f"Configuration backup created successfully: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            print(f"Error creating configuration backup: {e}")
            # Cleanup on error
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
    
    def _backup_config_files(self, backup_path: Path):
        """Backup all configuration files."""
        print("Backing up configuration files...")
        
        config_dir = backup_path / "configurations"
        config_dir.mkdir(exist_ok=True)
        
        for config_file in self.config_files:
            src_file = self.project_root / config_file
            if src_file.exists():
                # Create subdirectories as needed
                dest_file = config_dir / config_file
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                
                shutil.copy2(src_file, dest_file)
                print(f"  {config_file} backed up")
    
    def _backup_environment_config(self, backup_path: Path, include_sensitive: bool):
        """Backup environment configuration."""
        print("Backing up environment configuration...")
        
        env_dir = backup_path / "environment"
        env_dir.mkdir(exist_ok=True)
        
        # Backup environment files
        for env_file in self.env_files:
            src_file = self.project_root / env_file
            if src_file.exists():
                shutil.copy2(src_file, env_dir / env_file)
                print(f"  {env_file} backed up")
        
        # Create environment template
        env_template = self._create_environment_template(include_sensitive)
        with open(env_dir / "environment_template.json", "w") as f:
            json.dump(env_template, f, indent=2)
        
        print("  Environment template created")
    
    def _backup_system_config(self, backup_path: Path):
        """Backup system configuration."""
        print("Backing up system configuration...")
        
        system_dir = backup_path / "system"
        system_dir.mkdir(exist_ok=True)
        
        # Python configuration
        python_config = {
            "python_version": sys.version,
            "python_executable": sys.executable,
            "pip_version": self._get_pip_version(),
            "installed_packages": self._get_installed_packages()
        }
        
        with open(system_dir / "python_config.json", "w") as f:
            json.dump(python_config, f, indent=2)
        
        # Node.js configuration
        node_config = {
            "node_version": self._get_node_version(),
            "npm_version": self._get_npm_version(),
            "installed_packages": self._get_npm_packages()
        }
        
        with open(system_dir / "node_config.json", "w") as f:
            json.dump(node_config, f, indent=2)
        
        # System information
        system_info = {
            "platform": os.name,
            "os_name": os.uname().sysname if hasattr(os, 'uname') else "Windows",
            "architecture": os.uname().machine if hasattr(os, 'uname') else "x86_64",
            "current_directory": str(self.project_root),
            "backup_created": datetime.now().isoformat()
        }
        
        with open(system_dir / "system_info.json", "w") as f:
            json.dump(system_info, f, indent=2)
        
        print("  System configuration backed up")
    
    def _backup_deployment_config(self, backup_path: Path):
        """Backup deployment configuration."""
        print("Backing up deployment configuration...")
        
        deploy_dir = backup_path / "deployment"
        deploy_dir.mkdir(exist_ok=True)
        
        # Docker configuration
        docker_files = [
            "Dockerfile.api",
            "docker-compose.api.yml"
        ]
        
        for docker_file in docker_files:
            src_file = self.project_root / docker_file
            if src_file.exists():
                shutil.copy2(src_file, deploy_dir / docker_file)
                print(f"  {docker_file} backed up")
        
        # Vercel configuration
        vercel_file = self.project_root / "vercel.json"
        if vercel_file.exists():
            shutil.copy2(vercel_file, deploy_dir / "vercel.json")
            print("  vercel.json backed up")
        
        # Create deployment instructions
        deploy_instructions = self._create_deployment_instructions()
        with open(deploy_dir / "deployment_instructions.md", "w") as f:
            f.write(deploy_instructions)
        
        print("  Deployment instructions created")
    
    def _backup_documentation(self, backup_path: Path):
        """Backup documentation files."""
        print("Backing up documentation...")
        
        docs_dir = backup_path / "documentation"
        docs_dir.mkdir(exist_ok=True)
        
        # Copy specific documentation files
        for doc_pattern in self.doc_files:
            for doc_file in self.project_root.glob(doc_pattern):
                if doc_file.is_file() and not doc_file.name.startswith('.'):
                    shutil.copy2(doc_file, docs_dir / doc_file.name)
                    print(f"  {doc_file.name} backed up")
        
        # Copy docs directory if it exists
        docs_src = self.project_root / "docs"
        if docs_src.exists():
            shutil.copytree(docs_src, docs_dir / "docs")
            print("  docs/ directory backed up")
    
    def _backup_scripts(self, backup_path: Path):
        """Backup script files."""
        print("Backing up scripts...")
        
        scripts_dir = backup_path / "scripts"
        scripts_dir.mkdir(exist_ok=True)
        
        # Copy scripts directory
        scripts_src = self.project_root / "scripts"
        if scripts_src.exists():
            shutil.copytree(scripts_src, scripts_dir / "scripts")
            print("  scripts/ directory backed up")
        
        # Copy root script files
        for script_pattern in self.script_files:
            for script_file in self.project_root.glob(script_pattern):
                if script_file.is_file():
                    dest_file = scripts_dir / script_file.name
                    shutil.copy2(script_file, dest_file)
                    print(f"  {script_file.name} backed up")
    
    def _create_environment_template(self, include_sensitive: bool) -> Dict[str, Any]:
        """Create environment variable template."""
        template = {
            "description": "Environment variables template for Chess Analytics",
            "created_at": datetime.now().isoformat(),
            "variables": {}
        }
        
        # Common environment variables
        env_vars = [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "VITE_SUPABASE_URL",
            "VITE_SUPABASE_ANON_KEY",
            "VITE_ANALYSIS_API_URL",
            "API_HOST",
            "API_PORT",
            "STOCKFISH_PATH",
            "STOCKFISH_DEPTH",
            "STOCKFISH_SKILL_LEVEL",
            "ANALYSIS_DEFAULT_TYPE",
            "ANALYSIS_BATCH_SIZE",
            "LOG_LEVEL",
            "APP_ENV"
        ]
        
        for var in env_vars:
            value = os.getenv(var, "")
            if include_sensitive or not self._is_sensitive_var(var):
                template["variables"][var] = {
                    "value": value,
                    "required": var in ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
                    "description": self._get_var_description(var)
                }
            else:
                template["variables"][var] = {
                    "value": "[REDACTED]",
                    "required": var in ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
                    "description": self._get_var_description(var)
                }
        
        return template
    
    def _is_sensitive_var(self, var_name: str) -> bool:
        """Check if environment variable contains sensitive data."""
        sensitive_patterns = ["KEY", "SECRET", "PASSWORD", "TOKEN", "AUTH"]
        return any(pattern in var_name.upper() for pattern in sensitive_patterns)
    
    def _get_var_description(self, var_name: str) -> str:
        """Get description for environment variable."""
        descriptions = {
            "SUPABASE_URL": "Supabase project URL",
            "SUPABASE_ANON_KEY": "Supabase anonymous key",
            "SUPABASE_SERVICE_ROLE_KEY": "Supabase service role key (admin access)",
            "VITE_SUPABASE_URL": "Frontend Supabase URL",
            "VITE_SUPABASE_ANON_KEY": "Frontend Supabase anonymous key",
            "VITE_ANALYSIS_API_URL": "Analysis API URL for frontend",
            "API_HOST": "API server host",
            "API_PORT": "API server port",
            "STOCKFISH_PATH": "Path to Stockfish executable",
            "STOCKFISH_DEPTH": "Stockfish analysis depth",
            "STOCKFISH_SKILL_LEVEL": "Stockfish skill level",
            "ANALYSIS_DEFAULT_TYPE": "Default analysis type",
            "ANALYSIS_BATCH_SIZE": "Analysis batch size",
            "LOG_LEVEL": "Logging level",
            "APP_ENV": "Application environment (dev/production)"
        }
        return descriptions.get(var_name, "Environment variable")
    
    def _create_deployment_instructions(self) -> str:
        """Create deployment instructions."""
        return """# Chess Analytics Deployment Instructions

## Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Supabase account and project
- Stockfish engine

## Environment Setup
1. Copy `env.example` to `.env`
2. Fill in your Supabase credentials
3. Set `APP_ENV` to 'production' for production deployment

## Frontend Deployment (Vercel)
1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Deploy to Vercel: `vercel --prod`

## Backend Deployment (Docker)
1. Build the Docker image: `docker build -f Dockerfile.api -t chess-analytics-api .`
2. Run with Docker Compose: `docker-compose -f docker-compose.api.yml up -d`

## Manual Backend Setup
1. Install Python dependencies: `pip install -r requirements.txt`
2. Set environment variables
3. Run the API server: `python python/main.py`

## Database Setup
1. Run Supabase migrations: `supabase db push`
2. Verify database schema is up to date

## Verification
1. Check API health: `curl http://localhost:8002/health`
2. Check frontend: Open browser to deployed URL
3. Test analysis functionality

## Troubleshooting
- Check logs for errors
- Verify environment variables
- Ensure Stockfish is accessible
- Check database connectivity
"""
    
    def _create_config_manifest(self, backup_path: Path, include_sensitive: bool):
        """Create configuration manifest."""
        print("Creating configuration manifest...")
        
        manifest = {
            "backup_name": backup_path.name,
            "created_at": datetime.now().isoformat(),
            "project_root": str(self.project_root),
            "backup_version": "1.0.0",
            "description": "Chess Analytics Configuration Backup",
            "include_sensitive": include_sensitive,
            "config_files": self.config_files,
            "env_files": self.env_files,
            "doc_files": self.doc_files,
            "script_files": self.script_files,
            "system_info": {
                "python_version": sys.version,
                "platform": os.name,
                "current_directory": str(self.project_root)
            }
        }
        
        with open(backup_path / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
    
    def _get_pip_version(self) -> str:
        """Get pip version."""
        try:
            result = subprocess.run([sys.executable, "-m", "pip", "--version"], 
                                  capture_output=True, text=True, timeout=10)
            return result.stdout.strip()
        except:
            return "Unknown"
    
    def _get_installed_packages(self) -> List[str]:
        """Get list of installed Python packages."""
        try:
            result = subprocess.run([sys.executable, "-m", "pip", "list"], 
                                  capture_output=True, text=True, timeout=30)
            return result.stdout.strip().split('\n')[2:]  # Skip header lines
        except:
            return []
    
    def _get_node_version(self) -> str:
        """Get Node.js version."""
        try:
            result = subprocess.run(["node", "--version"], 
                                  capture_output=True, text=True, timeout=10)
            return result.stdout.strip()
        except:
            return "Not installed"
    
    def _get_npm_version(self) -> str:
        """Get npm version."""
        try:
            result = subprocess.run(["npm", "--version"], 
                                  capture_output=True, text=True, timeout=10)
            return result.stdout.strip()
        except:
            return "Not installed"
    
    def _get_npm_packages(self) -> List[str]:
        """Get list of installed npm packages."""
        try:
            result = subprocess.run(["npm", "list", "--depth=0"], 
                                  capture_output=True, text=True, timeout=30)
            return result.stdout.strip().split('\n')[1:]  # Skip header
        except:
            return []
    
    def _compress_backup(self, backup_path: Path) -> str:
        """Compress the backup directory."""
        print("Compressing backup...")
        
        compressed_path = f"{backup_path}.tar.gz"
        
        with tarfile.open(compressed_path, "w:gz") as tar:
            tar.add(backup_path, arcname=backup_path.name)
        
        # Remove uncompressed directory
        shutil.rmtree(backup_path)
        
        return compressed_path
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List available configuration backups."""
        backups = []
        
        for item in self.backup_dir.iterdir():
            if item.is_dir() and item.name.startswith("chess_analytics_config_"):
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                    backups.append(manifest)
            elif item.suffix == ".tar.gz" and item.name.startswith("chess_analytics_config_"):
                # Extract basic info from compressed backup
                backups.append({
                    "backup_name": item.stem,
                    "created_at": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
                    "compressed": True,
                    "size_mb": round(item.stat().st_size / (1024 * 1024), 2)
                })
        
        return sorted(backups, key=lambda x: x["created_at"], reverse=True)

def main():
    """Main function for running configuration backup operations."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Chess Analytics Configuration Backup")
    parser.add_argument("--action", choices=["backup", "list"], default="backup",
                       help="Action to perform")
    parser.add_argument("--include-sensitive", action="store_true", 
                       help="Include sensitive environment variables")
    parser.add_argument("--no-compress", action="store_true", help="Skip compression")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    
    args = parser.parse_args()
    
    try:
        backup_system = ConfigBackup(project_root=args.project_root)
        
        if args.action == "backup":
            backup_path = backup_system.create_backup(
                include_sensitive=args.include_sensitive,
                compress=not args.no_compress
            )
            print(f"Configuration backup completed: {backup_path}")
            
        elif args.action == "list":
            backups = backup_system.list_backups()
            print(f"\nAvailable configuration backups ({len(backups)}):")
            for backup in backups:
                print(f"  {backup['backup_name']} - {backup['created_at']}")
                if 'size_mb' in backup:
                    print(f"    Size: {backup['size_mb']} MB")
                if 'include_sensitive' in backup:
                    print(f"    Sensitive data: {'Yes' if backup['include_sensitive'] else 'No'}")
    
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
