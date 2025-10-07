# Chess Analytics Backup System

A comprehensive backup solution for the Chess Analytics project that handles code, database, configurations, and all project components.

## Overview

This backup system provides multiple levels of backup functionality:

- **Full Backup**: Complete backup of all components (database, code, configurations)
- **Quick Backup**: Code and configurations only (no database)
- **Component Backups**: Individual backups for specific components
- **Database Backup**: Schema and data backup for Supabase
- **Code Backup**: Source code and project files
- **Configuration Backup**: Settings, environment variables, and configurations

## Quick Start

### Windows (PowerShell)

```powershell
# Full backup (recommended)
.\scripts\backup.ps1 -Type full

# Quick backup (code + config only)
.\scripts\backup.ps1 -Type quick

# List available backups
.\scripts\backup.ps1 -Type list
```

### Linux/macOS (Python)

```bash
# Full backup
python scripts/backup_all.py

# Quick backup
python scripts/backup_all.py --action quick-backup

# List backups
python scripts/backup_all.py --action list
```

## Installation

### Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher (for code backup)
- Supabase project (for database backup)
- Required Python packages (installed automatically)

### Required Python Packages

The backup system will automatically install these packages if missing:

```bash
pip install supabase aiohttp asyncpg python-dotenv
```

## Usage

### Full Backup

Creates a comprehensive backup including database, code, and configurations:

```bash
# Basic full backup
python scripts/backup_all.py

# Full backup without database data (schema only)
python scripts/backup_all.py --no-data

# Full backup including sensitive environment variables
python scripts/backup_all.py --include-sensitive

# Full backup without Git history
python scripts/backup_all.py --no-git

# Full backup without compression
python scripts/backup_all.py --no-compress
```

### Quick Backup

Creates a quick backup of code and configurations (no database):

```bash
# Quick backup
python scripts/backup_all.py --action quick-backup

# Quick backup without compression
python scripts/backup_all.py --action quick-backup --no-compress
```

### Component-Specific Backups

#### Database Backup

```bash
# Database backup with data
python scripts/backup_database.py

# Database backup schema only
python scripts/backup_database.py --no-data

# List database backups
python scripts/backup_database.py --action list

# Restore from database backup
python scripts/backup_database.py --action restore --backup-name <backup_name>
```

#### Code Backup

```bash
# Code backup
python scripts/backup_code.py

# Code backup without Git
python scripts/backup_code.py --no-git

# List code backups
python scripts/backup_code.py --action list
```

#### Configuration Backup

```bash
# Configuration backup
python scripts/backup_config.py

# Configuration backup with sensitive data
python scripts/backup_config.py --include-sensitive

# List configuration backups
python scripts/backup_config.py --action list
```

## Backup Structure

### Full Backup Structure

```
chess_analytics_full_YYYYMMDD_HHMMSS/
├── database/                 # Database backup
│   ├── schema/              # Database schema
│   ├── data/                # Table data (if included)
│   ├── views/               # Database views
│   ├── functions/           # Database functions
│   └── policies/            # RLS policies
├── code/                    # Code backup
│   ├── source_code/         # Source code files
│   ├── configurations/      # Config files
│   ├── documentation/       # Documentation
│   ├── scripts/             # Scripts
│   └── migrations/          # Database migrations
├── configurations/          # Configuration backup
│   ├── configurations/      # Config files
│   ├── environment/         # Environment templates
│   ├── system/              # System info
│   ├── deployment/          # Deployment configs
│   ├── documentation/       # Docs
│   └── scripts/             # Scripts
├── manifest.json            # Backup manifest
└── RESTORATION_GUIDE.md     # Restoration instructions
```

### Individual Component Backups

Each component backup follows a similar structure with component-specific files and directories.

## Restoration

### From Full Backup

1. **Extract the backup** (if compressed):
   ```bash
   tar -xzf chess_analytics_full_YYYYMMDD_HHMMSS.tar.gz
   cd chess_analytics_full_YYYYMMDD_HHMMSS
   ```

2. **Follow the restoration guide**:
   ```bash
   cat RESTORATION_GUIDE.md
   ```

3. **Restore components**:
   - Database: Use the database backup to restore schema and data
   - Code: Copy source files to your project directory
   - Configurations: Copy configuration files and set up environment

### From Component Backups

Each component backup includes its own restoration instructions and can be restored independently.

## Configuration

### Environment Variables

The backup system uses these environment variables:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for data backup)

### Backup Directory

Backups are stored in the `backups/` directory by default. You can change this by modifying the backup scripts.

## Security Considerations

### Sensitive Data

- Environment variables containing sensitive data (keys, secrets, passwords) are excluded by default
- Use `--include-sensitive` flag only when necessary and in secure environments
- Never commit sensitive backup files to version control

### Backup Storage

- Store backups in a secure location
- Consider encrypting backup files for additional security
- Regularly test backup restoration procedures

## Troubleshooting

### Common Issues

1. **Missing Python packages**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Database connection errors**:
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure Supabase project is accessible

3. **Permission errors**:
   - Ensure write permissions to backup directory
   - Check file system permissions

4. **Large backup sizes**:
   - Use compression (default)
   - Exclude unnecessary files
   - Consider excluding Git history for quick backups

### Getting Help

1. Check the logs for error messages
2. Verify all prerequisites are installed
3. Test individual component backups
4. Check file permissions and disk space

## Advanced Usage

### Custom Backup Scripts

You can create custom backup scripts by importing and using the backup classes:

```python
from backup_database import DatabaseBackup
from backup_code import CodeBackup
from backup_config import ConfigBackup

# Create custom backup
db_backup = DatabaseBackup()
code_backup = CodeBackup()
config_backup = ConfigBackup()

# Run custom backup logic
```

### Automated Backups

Set up automated backups using cron (Linux/macOS) or Task Scheduler (Windows):

```bash
# Daily full backup at 2 AM
0 2 * * * cd /path/to/project && python scripts/backup_all.py
```

### Backup Verification

Always verify your backups by:

1. Testing restoration procedures
2. Checking backup integrity
3. Verifying file completeness
4. Testing in a separate environment

## File Formats

### Supported Formats

- **JSON**: Configuration files, manifests, data exports
- **CSV**: Tabular data exports
- **SQL**: Database schema and migrations
- **TAR.GZ**: Compressed archives
- **MD**: Documentation and guides

### Compression

All backups are compressed using TAR.GZ format by default. You can disable compression using the `--no-compress` flag.

## Version History

- **v1.0.0**: Initial release with full backup functionality
- Comprehensive database, code, and configuration backup
- Multiple backup types and options
- Cross-platform support (Windows, Linux, macOS)
- Automated dependency management

## License

This backup system is part of the Chess Analytics project and follows the same license terms.

## Support

For issues and questions:

1. Check this documentation
2. Review error logs
3. Test individual components
4. Verify system prerequisites

---

**Important**: Always test your backup and restoration procedures before relying on them in production environments.
