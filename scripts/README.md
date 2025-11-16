# Scripts Directory

This directory contains utility scripts for maintenance, deployment, and testing.

## Structure

### 📁 maintenance/
One-time maintenance and fix scripts.

- **database/** - SQL scripts for database maintenance, fixes, and diagnostics
  - `fix_*.sql` - Database fix scripts
  - `diagnose_*.sql` - Diagnostic queries
  - `update_*.sql` - Update scripts
  - `verify_*.sql` - Verification queries

- **stripe/** - Stripe integration maintenance scripts
  - Payment system fixes
  - Subscription management utilities

### 📁 deployment/
Deployment and server management scripts.

- **PowerShell scripts** (`.ps1`) - Windows deployment scripts
  - `start*.ps1` - Server startup scripts
  - `stop*.ps1` - Server shutdown scripts
- **Batch scripts** (`.bat`) - Windows batch files
  - `start*.bat` - Quick start scripts
  - `update*.bat` - Update scripts

### 📁 testing/
Testing utilities and test runners.

- **PowerShell scripts** - Test automation scripts
  - `run_*test*.ps1` - Test runners
  - `test_*.ps1` - Test utilities
  - `download_*.ps1` - Log and data download scripts

### 📁 utilities/
General utility scripts.

- Miscellaneous helper scripts

## Usage

### Running SQL Scripts
```bash
# Using Supabase CLI
supabase db push < scripts/maintenance/database/your_script.sql

# Or connect directly to your database
psql -h your-host -U your-user -d your-db -f scripts/maintenance/database/your_script.sql
```

### Running PowerShell Scripts
```powershell
# From project root
.\scripts\deployment\start-backend.ps1

# Or from scripts directory
cd scripts/deployment
.\start-backend.ps1
```

## Important Notes

⚠️ **Warning:** Many scripts in `maintenance/` are one-time fixes for specific issues. Review and understand a script before running it in production.

✅ **Best Practice:** Always test maintenance scripts in a development environment first.

📝 **Documentation:** Check the script file header for usage instructions and requirements.

## Common Scripts

- **Start Backend:** `scripts/deployment/start-backend.ps1` or `start-backend.bat`
- **Stop All Services:** `scripts/deployment/stop-all.ps1`
- **Run Tests:** `scripts/testing/run_maintest_production.ps1`

## Need Help?

Refer to the main [README.md](../README.md) for general project documentation.
