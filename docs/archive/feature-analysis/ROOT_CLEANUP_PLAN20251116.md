# Root Folder Cleanup Plan
*Generated: 2025-11-15*

## Current Problem
The root folder contains **200+ files**, making it difficult to navigate and maintain the project.

## Proposed Organization Structure

### 1. **docs/** (Already exists - consolidate all documentation)
```
docs/
├── archive/              # Historical documentation and analysis
│   ├── bug-reports/      # Bug investigation reports
│   ├── feature-analysis/ # Feature implementation reports
│   ├── performance/      # Performance analysis reports
│   └── security/         # Security fix reports
├── guides/               # User and developer guides
│   ├── deployment/       # Deployment guides
│   ├── testing/          # Testing guides
│   └── setup/            # Setup and configuration guides
└── api/                  # API documentation
```

### 2. **scripts/** (Already exists - consolidate all scripts)
```
scripts/
├── maintenance/          # One-time fix scripts
│   ├── database/         # SQL fix scripts
│   ├── stripe/           # Stripe-related fixes
│   └── users/            # User data fixes
├── deployment/           # Deployment scripts
├── testing/              # Test runner scripts
└── utilities/            # General utility scripts
```

### 3. **python/scripts/** (Already exists in python/)
```
python/
├── core/                 # Core application code (keep as-is)
├── scripts/              # Python utility scripts
│   ├── database/         # Database utilities
│   ├── stripe/           # Stripe integration scripts
│   ├── testing/          # Python test scripts
│   └── maintenance/      # One-time fixes
└── tests/                # Python tests
```

### 4. **logs/** (Should be gitignored)
- Move all `.log` files here
- Already in .gitignore

### 5. **temp/** or **test-data/** (For temporary files)
- JSON test results
- Temporary output files
- Should be gitignored

## File Migration Plan

### A. Documentation Files (Move to `docs/archive/`)

**Bug Reports & Investigations:**
- ANONYMOUS_LIMIT_BUG_REPORT.md
- API_ERROR_CONTRACT_FIX.md
- CODERABBIT_*.md (20+ files)
- STRIPE_PRICE_*.md
- PATIENT_SCORE_BUG_FIX.md
- etc.

**Feature Implementation Reports:**
- SUGGESTION_ARROWS_FEATURE_IMPLEMENTATION.md
- OPENING_DETECTION_ISSUE_SOLUTION.md
- BRILLIANT_MOVE_*.md
- CACHE_FIX_COMPLETE_SUMMARY.md
- etc.

**Performance Analysis:**
- ANALYZE_BUTTON_PERFORMANCE_ANALYSIS.md
- GAME_ANALYSIS_PERFORMANCE_OPTIMIZATION.md
- MEMORY_OPTIMIZATION_SUMMARY.md
- SPEED_OPTIMIZATION_RECOMMENDATIONS.md

**Security Reports:**
- SECURITY_ISSUES_ANALYSIS.md
- SECURITY_FIX_COMPLETE.txt
- HARDCODED_CREDENTIALS_FIX.md

### B. Guides (Move to `docs/guides/`)

**Deployment:**
- DEPLOYMENT_STEPS.md
- PRODUCTION_DEPLOYMENT_GUIDE.md
- PRICING_FIX_DEPLOYMENT_GUIDE.md
- STRIPE_PRODUCTION_DEPLOYMENT.md

**Testing:**
- AUTOMATED_TESTING_GUIDE.md
- MANUAL_TESTING_GUIDE.md

**Setup:**
- STRIPE_ENV_SETUP_GUIDE.md
- ENVIRONMENT_VARIABLES_GUIDE.md
- REQUIRED_ENV_VARS.md
- STRIPE_SETUP_CHECKLIST.md

**Quick Reference:**
- QUICK_START.md (keep in root OR move to docs/)
- CAPACITY_QUICK_REFERENCE.md
- PATIENT_FIX_QUICK_REFERENCE.txt

### C. SQL Scripts (Move to `scripts/maintenance/database/`)
- fix_*.sql (20+ files)
- diagnose_*.sql
- update_*.sql
- create_*.sql
- verify_*.sql
- remove_*.sql
- apply_signup_fix.sql
- manual_upgrade_user.sql
- etc.

**Exception:** If a SQL file is a proper migration, it should go to `supabase/migrations/`

### D. Python Scripts (Move to `python/scripts/`)

**Database Scripts:**
- check_*.py
- diagnose_*.py
- backfill_opening_normalized.py
- cleanup_temp_files.py

**Stripe Scripts:**
- fix_stripe_*.py
- update_stripe_*.py
- cancel_eur_subscription*.py
- test_stripe_*.py

**Testing Scripts:**
- test_*.py (except core test files)
- run_*.py
- comprehensive_test_runner.py

**Maintenance Scripts:**
- fix_*.py
- update_*.py
- monitor_memory.py

### E. Log Files (Move to `logs/` - already gitignored)
- backend_*.log
- test_output.log
- All .log files

### F. Temporary/Test Data Files (Move to `temp/` or delete)
- *.json (test results, temporary data)
- external_chess_com_oct.json
- lakis5_analysis.json
- game_analyses_sample.json
- comprehensive_test_results_*.json
- vercel_logs_*.json

**Keep in root:**
- example_config.json (if it's actually used)

### G. PowerShell/Batch Scripts (Move to `scripts/`)

**Deployment:**
- update_vercel_frontend.bat
- START_BACKEND_LOCAL.ps1*

**Testing:**
- run_maintest_production.ps1
- test_cache.ps1
- download_vercel_logs.ps1

**Utilities:**
- start-all.ps1
- stop-all.ps1
- start-backend.bat/ps1

### H. Files to DELETE (if safe)
- `python.zip` (backup? should be in version control)
- `old_server.py` (if truly deprecated)
- `diff.txt` (temporary comparison file)
- `Projectschess-analytics ; git log --oneline -1 --decorate` (what is this?)
- `update, usage tracking, Stripe integration, and UI improvements` (malformed filename)

## Implementation Steps

1. **Create folder structure** (new folders needed):
   - `docs/archive/bug-reports/`
   - `docs/archive/feature-analysis/`
   - `docs/archive/performance/`
   - `docs/archive/security/`
   - `docs/guides/deployment/`
   - `docs/guides/testing/`
   - `docs/guides/setup/`
   - `scripts/maintenance/database/`
   - `scripts/maintenance/stripe/`
   - `scripts/deployment/`
   - `scripts/testing/`
   - `python/scripts/database/`
   - `python/scripts/stripe/`
   - `python/scripts/testing/`
   - `python/scripts/maintenance/`
   - `temp/` (add to .gitignore)

2. **Move files systematically**:
   - Start with log files (clear win)
   - Move documentation (largest category)
   - Move SQL scripts
   - Move Python scripts
   - Move PowerShell/batch scripts
   - Move temporary/test data files

3. **Update references**:
   - Check if any documentation references other docs (update paths)
   - Check if any scripts are referenced in package.json or other configs
   - Update any README references

4. **Update .gitignore**:
   - Add `temp/` directory
   - Ensure `logs/` is covered
   - Add patterns for common temporary files

5. **Create README files**:
   - `docs/README.md` - Guide to documentation structure
   - `scripts/README.md` - Guide to available scripts
   - `python/scripts/README.md` - Guide to Python utilities

## Expected Result

**Root folder should contain only (~30 files):**
- Package management: package.json, package-lock.json, requirements.txt
- TypeScript config: tsconfig.json, tsconfig.node.json, typedoc.json
- Build tools: vite.config.ts, vitest.config.ts, playwright.config.ts
- Styling: tailwind.config.js, postcss.config.js
- Linting: .eslintrc.cjs, .prettierrc, .prettierignore
- Git: .gitignore, .gitattributes
- Deployment: vercel.json, nixpacks.toml, render.yaml, docker-compose.api.yml, Dockerfile.api
- Environment: env.example, .env.local (gitignored), env.phase1 (?)
- Scripts: validate-env.js (maybe move to scripts/)
- Documentation: README.md, CHANGELOG.md, QUICK_START.md (optional)
- Entry point: index.html
- Directories: src/, python/, supabase/, tests/, docs/, scripts/, public/, node_modules/, dist/, logs/

## Benefits
1. **Easier navigation** - Find files quickly
2. **Better organization** - Related files grouped together
3. **Cleaner git status** - Less noise in root
4. **Professional appearance** - Standard project structure
5. **Easier onboarding** - New developers can understand structure
6. **Better IDE performance** - Less files to index in root

## Risks & Considerations
- Some scripts may reference other files with relative paths (need to update)
- Documentation may link to other documentation (need to update)
- Git history shows files moved (use `git mv` to preserve history)
- Any CI/CD pipelines may reference scripts (need to update)

## Recommended Action
Would you like me to:
1. **Execute this plan automatically** - I'll move files and update references
2. **Do it step-by-step** - We'll go through each category together
3. **Create a migration script** - Script to do the moves safely

I recommend option 2 (step-by-step) to ensure nothing breaks.
