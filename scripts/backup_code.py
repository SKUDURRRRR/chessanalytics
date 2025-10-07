#!/usr/bin/env python3
"""
Code Backup Script for Chess Analytics
Creates comprehensive backups of all source code, configurations, and project files.
"""

import os
import json
import shutil
import tarfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
import hashlib
import subprocess
import sys

class CodeBackup:
    """Handles code backup operations for the chess analytics system."""
    
    def __init__(self, project_root: str = ".", backup_dir: str = "backups"):
        """Initialize the code backup system."""
        self.project_root = Path(project_root).resolve()
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
        # Files and directories to include in backup
        self.include_patterns = [
            "src/**/*",
            "python/**/*",
            "supabase/**/*",
            "scripts/**/*",
            "docs/**/*",
            "tests/**/*",
            "*.json",
            "*.js",
            "*.ts",
            "*.tsx",
            "*.py",
            "*.sql",
            "*.md",
            "*.yml",
            "*.yaml",
            "*.toml",
            "*.txt",
            "*.sh",
            "*.ps1",
            "*.bat",
            "*.exe",
            "*.config.*",
            "*.example",
            "Dockerfile*",
            "docker-compose*.yml",
            "requirements.txt",
            "package.json",
            "package-lock.json",
            "tsconfig*.json",
            "vite.config.*",
            "tailwind.config.*",
            "postcss.config.*",
            "playwright.config.*",
            "vitest.config.*",
            "typedoc.json",
            "vercel.json",
            "env.example",
            "README.md",
            "QUICK_START.md",
            "*.log"
        ]
        
        # Files and directories to exclude
        self.exclude_patterns = [
            "node_modules/**/*",
            "dist/**/*",
            "build/**/*",
            ".git/**/*",
            "__pycache__/**/*",
            "*.pyc",
            "*.pyo",
            "*.pyd",
            ".pytest_cache/**/*",
            ".coverage",
            "coverage/**/*",
            ".nyc_output/**/*",
            "backups/**/*",
            ".env",
            ".env.local",
            ".env.production",
            "*.log",
            "*.tmp",
            ".DS_Store",
            "Thumbs.db",
            "*.swp",
            "*.swo",
            "*~",
            ".vscode/**/*",
            ".idea/**/*",
            "*.sublime-*"
        ]
        
        # Critical files that must be included
        self.critical_files = [
            "package.json",
            "requirements.txt",
            "tsconfig.json",
            "vite.config.ts",
            "tailwind.config.js",
            "postcss.config.js",
            "playwright.config.ts",
            "vitest.config.ts",
            "vercel.json",
            "env.example",
            "README.md",
            "python/main.py",
            "python/core/config.py",
            "src/main.tsx",
            "src/App.tsx"
        ]
    
    def create_backup(self, include_git: bool = True, compress: bool = True) -> str:
        """Create a comprehensive code backup."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chess_analytics_code_{timestamp}"
        backup_path = self.backup_dir / backup_name
        backup_path.mkdir(exist_ok=True)
        
        print(f"Creating code backup: {backup_name}")
        
        try:
            # 1. Backup source code
            self._backup_source_code(backup_path)
            
            # 2. Backup configurations
            self._backup_configurations(backup_path)
            
            # 3. Backup documentation
            self._backup_documentation(backup_path)
            
            # 4. Backup scripts
            self._backup_scripts(backup_path)
            
            # 5. Backup database migrations
            self._backup_migrations(backup_path)
            
            # 6. Backup Git repository (if requested)
            if include_git:
                self._backup_git_repository(backup_path)
            
            # 7. Create project manifest
            self._create_project_manifest(backup_path)
            
            # 8. Create file inventory
            self._create_file_inventory(backup_path)
            
            # 9. Compress if requested
            if compress:
                compressed_path = self._compress_backup(backup_path)
                print(f"Code backup compressed to: {compressed_path}")
                return str(compressed_path)
            
            print(f"Code backup created successfully: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            print(f"Error creating code backup: {e}")
            # Cleanup on error
            if backup_path.exists():
                shutil.rmtree(backup_path)
            raise
    
    def _backup_source_code(self, backup_path: Path):
        """Backup all source code files."""
        print("Backing up source code...")
        
        src_dir = backup_path / "source_code"
        src_dir.mkdir(exist_ok=True)
        
        # Copy React/TypeScript source
        if (self.project_root / "src").exists():
            shutil.copytree(
                self.project_root / "src",
                src_dir / "src",
                ignore=self._get_ignore_function()
            )
            print("  React/TypeScript source backed up")
        
        # Copy Python backend
        if (self.project_root / "python").exists():
            shutil.copytree(
                self.project_root / "python",
                src_dir / "python",
                ignore=self._get_ignore_function()
            )
            print("  Python backend backed up")
        
        # Copy Supabase functions
        if (self.project_root / "supabase").exists():
            shutil.copytree(
                self.project_root / "supabase",
                src_dir / "supabase",
                ignore=self._get_ignore_function()
            )
            print("  Supabase functions backed up")
    
    def _backup_configurations(self, backup_path: Path):
        """Backup all configuration files."""
        print("Backing up configurations...")
        
        config_dir = backup_path / "configurations"
        config_dir.mkdir(exist_ok=True)
        
        config_files = [
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
            "env.example",
            "docker-compose.api.yml",
            "Dockerfile.api",
            "example_config.json"
        ]
        
        for config_file in config_files:
            src_file = self.project_root / config_file
            if src_file.exists():
                shutil.copy2(src_file, config_dir / config_file)
                print(f"  {config_file} backed up")
    
    def _backup_documentation(self, backup_path: Path):
        """Backup all documentation."""
        print("Backing up documentation...")
        
        docs_dir = backup_path / "documentation"
        docs_dir.mkdir(exist_ok=True)
        
        # Copy docs directory
        if (self.project_root / "docs").exists():
            shutil.copytree(
                self.project_root / "docs",
                docs_dir / "docs",
                ignore=self._get_ignore_function()
            )
            print("  Documentation directory backed up")
        
        # Copy root documentation files
        doc_files = [
            "README.md",
            "QUICK_START.md",
            "*.md"
        ]
        
        for pattern in doc_files:
            for doc_file in self.project_root.glob(pattern):
                if doc_file.is_file() and not doc_file.name.startswith('.'):
                    shutil.copy2(doc_file, docs_dir / doc_file.name)
                    print(f"  {doc_file.name} backed up")
    
    def _backup_scripts(self, backup_path: Path):
        """Backup all scripts."""
        print("Backing up scripts...")
        
        scripts_dir = backup_path / "scripts"
        scripts_dir.mkdir(exist_ok=True)
        
        if (self.project_root / "scripts").exists():
            shutil.copytree(
                self.project_root / "scripts",
                scripts_dir / "scripts",
                ignore=self._get_ignore_function()
            )
            print("  Scripts directory backed up")
        
        # Copy root scripts
        script_files = [
            "start-all.ps1",
            "start-backend.ps1",
            "start-backend.bat",
            "stop-all.ps1"
        ]
        
        for script_file in script_files:
            src_file = self.project_root / script_file
            if src_file.exists():
                shutil.copy2(src_file, scripts_dir / script_file)
                print(f"  {script_file} backed up")
    
    def _backup_migrations(self, backup_path: Path):
        """Backup database migrations."""
        print("Backing up database migrations...")
        
        migrations_dir = backup_path / "migrations"
        migrations_dir.mkdir(exist_ok=True)
        
        if (self.project_root / "supabase" / "migrations").exists():
            shutil.copytree(
                self.project_root / "supabase" / "migrations",
                migrations_dir / "supabase_migrations"
            )
            print("  Database migrations backed up")
    
    def _backup_git_repository(self, backup_path: Path):
        """Backup Git repository information."""
        print("Backing up Git repository...")
        
        git_dir = backup_path / "git"
        git_dir.mkdir(exist_ok=True)
        
        try:
            # Get Git information
            git_info = {
                "current_branch": self._run_git_command("rev-parse --abbrev-ref HEAD"),
                "current_commit": self._run_git_command("rev-parse HEAD"),
                "commit_message": self._run_git_command("log -1 --pretty=%B"),
                "commit_date": self._run_git_command("log -1 --pretty=%ci"),
                "remote_url": self._run_git_command("remote get-url origin"),
                "status": self._run_git_command("status --porcelain"),
                "branches": self._run_git_command("branch -a").split('\n'),
                "tags": self._run_git_command("tag -l").split('\n') if self._run_git_command("tag -l") else []
            }
            
            with open(git_dir / "git_info.json", "w") as f:
                json.dump(git_info, f, indent=2)
            
            # Create a patch file of uncommitted changes
            if git_info["status"].strip():
                patch_content = self._run_git_command("diff")
                with open(git_dir / "uncommitted_changes.patch", "w") as f:
                    f.write(patch_content)
                print("  Uncommitted changes saved as patch")
            
            print("  Git information backed up")
            
        except Exception as e:
            print(f"  Warning: Could not backup Git information: {e}")
    
    def _create_project_manifest(self, backup_path: Path):
        """Create project manifest with metadata."""
        print("Creating project manifest...")
        
        manifest = {
            "project_name": "Chess Analytics",
            "backup_name": backup_path.name,
            "created_at": datetime.now().isoformat(),
            "project_root": str(self.project_root),
            "backup_version": "1.0.0",
            "description": "Chess Analytics Code Backup",
            "include_patterns": self.include_patterns,
            "exclude_patterns": self.exclude_patterns,
            "critical_files": self.critical_files,
            "file_counts": self._count_files(),
            "total_size_mb": self._calculate_total_size()
        }
        
        with open(backup_path / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
    
    def _create_file_inventory(self, backup_path: Path):
        """Create detailed file inventory."""
        print("Creating file inventory...")
        
        inventory = []
        
        for root, dirs, files in os.walk(backup_path):
            for file in files:
                file_path = Path(root) / file
                relative_path = file_path.relative_to(backup_path)
                
                try:
                    stat = file_path.stat()
                    file_info = {
                        "path": str(relative_path),
                        "size_bytes": stat.st_size,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "extension": file_path.suffix,
                        "checksum": self._calculate_checksum(file_path)
                    }
                    inventory.append(file_info)
                except Exception as e:
                    print(f"Warning: Could not process file {file_path}: {e}")
        
        with open(backup_path / "file_inventory.json", "w") as f:
            json.dump(inventory, f, indent=2)
        
        print(f"  File inventory created with {len(inventory)} files")
    
    def _count_files(self) -> Dict[str, int]:
        """Count files by type."""
        counts = {}
        
        for root, dirs, files in os.walk(self.project_root):
            for file in files:
                ext = Path(file).suffix.lower()
                if ext:
                    counts[ext] = counts.get(ext, 0) + 1
                else:
                    counts["no_extension"] = counts.get("no_extension", 0) + 1
        
        return counts
    
    def _calculate_total_size(self) -> float:
        """Calculate total project size in MB."""
        total_size = 0
        
        for root, dirs, files in os.walk(self.project_root):
            for file in files:
                try:
                    file_path = Path(root) / file
                    total_size += file_path.stat().st_size
                except:
                    pass
        
        return round(total_size / (1024 * 1024), 2)
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate MD5 checksum of a file."""
        try:
            hash_md5 = hashlib.md5()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except:
            return "error"
    
    def _run_git_command(self, command: str) -> str:
        """Run a Git command and return output."""
        try:
            result = subprocess.run(
                ["git"] + command.split(),
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.stdout.strip()
        except:
            return ""
    
    def _get_ignore_function(self):
        """Get ignore function for shutil.copytree."""
        def ignore_func(dir, files):
            ignored = set()
            for file in files:
                file_path = Path(dir) / file
                relative_path = file_path.relative_to(self.project_root)
                
                # Check exclude patterns
                for pattern in self.exclude_patterns:
                    if self._matches_pattern(str(relative_path), pattern):
                        ignored.add(file)
                        break
            
            return ignored
        
        return ignore_func
    
    def _matches_pattern(self, path: str, pattern: str) -> bool:
        """Check if path matches pattern (simplified glob matching)."""
        import fnmatch
        return fnmatch.fnmatch(path, pattern)
    
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
        """List available code backups."""
        backups = []
        
        for item in self.backup_dir.iterdir():
            if item.is_dir() and item.name.startswith("chess_analytics_code_"):
                manifest_path = item / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path, "r") as f:
                        manifest = json.load(f)
                    backups.append(manifest)
            elif item.suffix == ".tar.gz" and item.name.startswith("chess_analytics_code_"):
                # Extract basic info from compressed backup
                backups.append({
                    "backup_name": item.stem,
                    "created_at": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
                    "compressed": True,
                    "size_mb": round(item.stat().st_size / (1024 * 1024), 2)
                })
        
        return sorted(backups, key=lambda x: x["created_at"], reverse=True)

def main():
    """Main function for running code backup operations."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Chess Analytics Code Backup")
    parser.add_argument("--action", choices=["backup", "list"], default="backup",
                       help="Action to perform")
    parser.add_argument("--no-git", action="store_true", help="Skip Git repository backup")
    parser.add_argument("--no-compress", action="store_true", help="Skip compression")
    parser.add_argument("--project-root", default=".", help="Project root directory")
    
    args = parser.parse_args()
    
    try:
        backup_system = CodeBackup(project_root=args.project_root)
        
        if args.action == "backup":
            backup_path = backup_system.create_backup(
                include_git=not args.no_git,
                compress=not args.no_compress
            )
            print(f"Code backup completed: {backup_path}")
            
        elif args.action == "list":
            backups = backup_system.list_backups()
            print(f"\nAvailable code backups ({len(backups)}):")
            for backup in backups:
                print(f"  {backup['backup_name']} - {backup['created_at']}")
                if 'size_mb' in backup:
                    print(f"    Size: {backup['size_mb']} MB")
                if 'file_counts' in backup:
                    print(f"    Files: {sum(backup['file_counts'].values())}")
    
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
