# MAINTEST Pre-deployment Test Suite

## Overview

MAINTEST is a comprehensive pre-deployment test suite for the Chess Analytics platform. It validates all major functionality before pushing to production, including:

- ✅ Security & credential validation
- ✅ Game imports (Lichess & Chess.com)
- ✅ Game analysis (bulk & single)
- ✅ Data correctness & consistency
- ✅ Frontend UI functionality
- ✅ Match history & analytics pages
- ✅ Game analysis page features

## Quick Start

### Prerequisites

1. **Environment Setup:**
   ```bash
   # Ensure .env file exists with all credentials
   cp env.example .env
   # Edit .env and add your actual credentials
   ```

2. **Backend Running:**
   ```bash
   # Start the backend API
   cd python
   python main.py
   # Should be running on http://localhost:8002
   ```

3. **Frontend Running:**
   ```bash
   # Start the frontend (in another terminal)
   npm run dev
   # Should be running on http://localhost:3000
   ```

4. **Install Dependencies:**
   ```bash
   # Python dependencies
   pip install -r requirements.txt
   
   # Node dependencies (for Playwright)
   npm install
   npx playwright install
   ```

### Running Tests

#### Quick Smoke Test (2-3 minutes)
```bash
python run_MAINTEST.py --quick
```

Perfect for:
- Before committing code changes
- Quick validation during development
- CI/CD pipeline checks

#### Full Comprehensive Test (10-15 minutes)
```bash
python run_MAINTEST.py --full
```

Perfect for:
- Before pushing to production
- After major feature changes
- Weekly validation checks

#### Backend Tests Only
```bash
python run_MAINTEST.py --backend-only
```

#### Frontend Tests Only
```bash
python run_MAINTEST.py --frontend-only
```

## What Gets Tested

### 🔒 Security & Credentials

- **Environment Variables:** Validates all required env vars exist and aren't placeholders
- **Secret Scanning:** Scans code for accidentally exposed credentials
- **RLS Policies:** Tests Row Level Security policies work correctly
- **Stockfish Availability:** Verifies Stockfish executable is accessible

### 📥 Game Imports

- **Lichess Import:** Tests importing games from Lichess API
- **Chess.com Import:** Tests importing games from Chess.com API
- **Smart Import:** Tests smart import with new game detection
- **Duplicate Prevention:** Verifies re-importing doesn't create duplicates

### 🔬 Game Analysis

- **Bulk Analysis:** Tests analyzing multiple games (5 games)
- **Single Game Analysis:** Tests analyzing one game with full move data
- **Reanalysis:** Tests re-analyzing already analyzed games
- **Stockfish Configuration:** Verifies depth and skill level settings

### ✅ Data Correctness

- **Accuracy Values:** Validates accuracy scores are in valid range (0-100)
- **Opening Names:** Checks that games have opening names (not "Unknown")
- **Personality Scores:** Validates personality scores are in valid ranges
- **Data Consistency:** Cross-checks game counts across tables

### 🎨 Frontend Tests (Playwright)

- **Player Search:** Tests searching for existing and new players
- **Analytics Page:** Validates ELO graph, win rates, openings, personality radar
- **Match History:** Tests game list, pagination, opening/opponent filters
- **Game Analysis Page:** Tests chessboard, move list, evaluation chart, reanalysis

## Test Results

### Console Output

Tests print results to console in real-time:

```
================================================================================
🧪 MAINTEST PRE-DEPLOYMENT TEST SUITE
================================================================================
Mode: Full
Started: 2025-01-15 14:30:00
================================================================================

================================================================================
SECURITY & CREDENTIALS
================================================================================
✅ PASS: Environment Variables Exist
✅ PASS: Environment Variables Not Placeholders
✅ PASS: Stockfish Executable Exists
✅ PASS: No Exposed Secrets in Code
✅ PASS: RLS Anonymous Blocked
✅ PASS: RLS Service Role Access

================================================================================
BACKEND TESTS
================================================================================
📥 Testing Lichess import...
✅ Imported 10 games

... (more tests)

================================================================================
✅ ALL TESTS PASSED - READY FOR PRODUCTION
================================================================================
```

### HTML Report

An HTML report is automatically generated with:
- Detailed test results with pass/fail status
- Timing information for each test
- Security findings highlighted
- Visual summary with charts
- Saved to: `MAINTEST_results_YYYYMMDD_HHMMSS.html`

## Troubleshooting

### Backend Not Running

**Error:** `Failed to connect to API`

**Solution:**
```bash
cd python
python main.py
```

### Frontend Not Running

**Error:** `Navigation timeout`

**Solution:**
```bash
npm run dev
```

### Missing Credentials

**Error:** `Missing required environment variables`

**Solution:**
1. Check `.env` file exists
2. Verify all required vars are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Stockfish Not Found

**Error:** `Stockfish executable not found`

**Solution:**
1. Set `STOCKFISH_PATH` in `.env`:
   ```
   STOCKFISH_PATH=./stockfish/stockfish.exe  # Windows
   STOCKFISH_PATH=./stockfish/stockfish      # Linux/Mac
   ```
2. Or install Stockfish to system PATH

### Playwright Installation Issues

**Error:** `Playwright not installed`

**Solution:**
```bash
npm install @playwright/test
npx playwright install
```

### Test Timeouts

**Error:** Tests timing out

**Solution:**
1. Increase timeout in `MAINTEST_config.py`
2. Check backend/frontend are responsive
3. Check network connection to Lichess/Chess.com APIs

### Security Tests Failing

**Error:** `RLS policies failed`

**Solution:**
1. Check Supabase RLS policies are configured
2. Run `RESTORE_SECURE_RLS_POLICIES.sql` in Supabase SQL editor
3. Verify service role key has correct permissions

### Test Data Issues

**Error:** `No games found`

**Solution:**
1. Ensure test users have data:
   - `penkinisShachmatistas` (Lichess)
   - `skudurelis` (Chess.com)
2. Run import manually first to populate data

## Configuration

### Test Users

Edit `tests/MAINTEST_config.py` to change test users:

```python
TEST_USERS = {
    'lichess_existing': 'your_lichess_user',
    'chesscom_existing': 'your_chesscom_user',
}
```

### Thresholds

Adjust validation thresholds in `tests/MAINTEST_config.py`:

```python
THRESHOLDS = {
    'min_games': 10,
    'accuracy_range': (0, 100),
    'max_import_time': 120,  # seconds
    'max_analysis_time_per_game': 30,
}
```

### API URLs

Set custom URLs via environment variables:

```bash
export VITE_ANALYSIS_API_URL=http://localhost:8002
export FRONTEND_URL=http://localhost:3000
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Pre-deployment Tests

on:
  push:
    branches: [ main, development ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          npm install
          npx playwright install
      
      - name: Run MAINTEST
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: python run_MAINTEST.py --quick
```

## Best Practices

### Before Committing Code

```bash
# Run quick tests to catch obvious issues
python run_MAINTEST.py --quick
```

### Before Pushing to Production

```bash
# Run full test suite
python run_MAINTEST.py --full

# Review HTML report
# Open MAINTEST_results_*.html in browser

# Only proceed if ALL tests pass
```

### After Major Changes

```bash
# Test specific area that changed
python run_MAINTEST.py --backend-only   # For backend changes
python run_MAINTEST.py --frontend-only  # For frontend changes

# Then run full suite before production
python run_MAINTEST.py --full
```

### Weekly Validation

```bash
# Run full suite weekly to catch regression
python run_MAINTEST.py --full

# Save reports for comparison
# Check for new failures or degraded performance
```

## File Structure

```
chess-analytics/
├── run_MAINTEST.py              # Master orchestrator
├── tests/
│   ├── MAINTEST_config.py       # Test configuration
│   ├── MAINTEST_security.py     # Security tests
│   ├── MAINTEST_backend.py      # Backend tests
│   ├── MAINTEST_frontend.spec.ts # Frontend tests
│   └── MAINTEST_report.py       # Report generator
├── MAINTEST_README.md           # This file
└── MAINTEST_results_*.html      # Generated reports
```

## Support

### Common Issues

See **Troubleshooting** section above.

### Getting Help

1. Check error messages in console
2. Review HTML report for detailed failure info
3. Check individual test files for specific test logic
4. Verify environment setup matches requirements

## Version History

- **v1.0** (2025-01-15): Initial release
  - Security & credential validation
  - Backend API tests
  - Frontend Playwright tests
  - HTML report generation
  - Quick and full modes

## License

Part of Chess Analytics Platform - See main repository license.

