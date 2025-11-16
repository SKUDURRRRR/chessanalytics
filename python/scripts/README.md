# Python Scripts Directory

This directory contains Python utility scripts for database operations, Stripe integration, testing, and maintenance.

## Structure

### 📁 database/
Database-related utility scripts.

- `check_*.py` - Database inspection and validation scripts
- `backfill_*.py` - Data backfill utilities
- `cleanup_*.py` - Database cleanup scripts
- Database diagnostic tools

**Example Usage:**
```bash
cd python/scripts/database
python check_database_health.py
```

### 📁 stripe/
Stripe integration and payment system utilities.

- `*stripe*.py` - Stripe API integration scripts
- `*price*.py` - Pricing and price ID management
- `cancel_*.py` - Subscription cancellation utilities
- `diagnose_*.py` - Stripe diagnostic tools

**Example Usage:**
```bash
cd python/scripts/stripe
python check_stripe_prices.py
```

### 📁 testing/
Testing and diagnostic scripts.

- `test_*.py` - Test utilities and validators
- `run_*.py` - Test runners
- `monitor_*.py` - Monitoring and performance testing
- Integration test scripts

**Example Usage:**
```bash
cd python/scripts/testing
python run_integration_tests.py
```

### 📁 maintenance/
One-time maintenance and fix scripts.

- `fix_*.py` - Fix scripts for specific issues
- `update_*.py` - Data update utilities
- Migration helpers
- Cleanup tools

**Example Usage:**
```bash
cd python/scripts/maintenance
python fix_data_issue.py
```

## Requirements

Most scripts require:
- Python 3.10+
- Dependencies from `requirements.txt` in project root
- Environment variables (typically from `python/.env.local`)

Install dependencies:
```bash
pip install -r requirements.txt
```

## Running Scripts

### From Project Root
```bash
python python/scripts/database/check_*.py
```

### From Script Directory
```bash
cd python/scripts/database
python check_*.py
```

### With Virtual Environment
```bash
# Activate venv first
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Then run script
python python/scripts/database/check_*.py
```

## Important Notes

⚠️ **Environment Variables:** Most scripts require Supabase credentials and other environment variables. Ensure `python/.env.local` is properly configured.

⚠️ **Production Safety:** Scripts in `maintenance/` are often one-time fixes. Review code before running in production.

✅ **Best Practice:** Always test scripts in development environment first.

📝 **Documentation:** Check script docstrings and comments for usage instructions.

## Common Tasks

### Check Database
```bash
python python/scripts/database/check_database.py
```

### Verify Stripe Integration
```bash
python python/scripts/stripe/check_stripe_prices.py
```

### Run Tests
```bash
python python/scripts/testing/run_comprehensive_tests.py
```

### Monitor Performance
```bash
python python/scripts/testing/monitor_memory.py
```

## Core vs Scripts

**Important:** This `python/scripts/` directory contains **utility scripts only**.

The main application code is in:
- `python/core/` - Core application logic (analysis engine, API server, etc.)
- `python/main.py` - Application entry point

Do NOT put application code in `scripts/` - it's for utilities and maintenance only.

## Need Help?

- Main README: [../../README.md](../../README.md)
- Python Core Documentation: [../core/README.md](../core/README.md) (if exists)
- Setup Guide: [../../docs/guides/setup/](../../docs/guides/setup/)
