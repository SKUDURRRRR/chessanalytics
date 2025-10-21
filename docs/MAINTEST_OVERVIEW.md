# MAINTEST - Pre-deployment Test Suite

## Quick Reference

**MAINTEST** is the comprehensive pre-deployment test suite that validates all critical functionality before production deployment.

### What MAINTEST Tests

✅ **Security & Credentials**
- RLS policies for public analytics model
- Anonymous users CAN read (required for public app)
- Anonymous users CANNOT write (security)
- Service role has full access
- No exposed secrets in code

✅ **Backend Functionality**
- Game imports (Lichess & Chess.com)
- Smart import and duplicate prevention
- Game analysis (bulk & single)
- Data correctness and consistency
- Case-insensitive username handling

✅ **Frontend E2E Tests**
- Player search and analytics pages
- Match history loading
- Game analysis page features
- Re-analyze button functionality (enabled + clickable)
- 401/403/RLS error monitoring
- Complete user flows

### Critical Features

**1. Public Analytics RLS Model**
- Tests that anonymous users CAN read games/PGN (app requirement)
- Tests that anonymous users CANNOT write (security requirement)
- Catches missing RLS policies that would break the entire app

**2. Case Sensitivity Testing**
- Tests username variations: `hikaru`, `Hikaru`, `HIKARU`, `HiKaRu`
- Validates canonicalization to lowercase
- Prevents "Game not found" errors from case mismatches

**3. Re-analyze Button Validation**
- Checks button EXISTS
- Checks button is ENABLED (not disabled)
- Optionally clicks and verifies it works
- Monitors for RLS/auth errors

**4. Console Error Monitoring**
- Zero tolerance for 401/403/RLS errors
- Distinguishes app-breaking vs non-critical errors
- Tests complete user flows without auth errors

### Running MAINTEST

**Quick Mode (Essential Tests):**
```bash
python run_MAINTEST.py --quick
```

**Full Mode (Comprehensive):**
```bash
python run_MAINTEST.py --full
```

**Individual Components:**
```bash
# Backend tests
python tests/MAINTEST_backend.py --quick

# Frontend tests
npx playwright test tests/MAINTEST_frontend.spec.ts

# Security tests
python tests/MAINTEST_security.py --quick
```

### Documentation

- **[MAINTEST_README.md](MAINTEST_README.md)** - Complete setup and usage guide
- **[MAINTEST_FEATURES.md](MAINTEST_FEATURES.md)** - Detailed feature documentation
- **[MAINTEST_QUICK_REFERENCE.md](MAINTEST_QUICK_REFERENCE.md)** - Quick command reference

### Root Directory Files

- **[MAINTEST_GAP_ANALYSIS.md](../MAINTEST_GAP_ANALYSIS.md)** - Analysis of what tests were missing
- **[MAINTEST_CRITICAL_FAILURE_ANALYSIS.md](../MAINTEST_CRITICAL_FAILURE_ANALYSIS.md)** - Why old tests missed production failures
- **[MAINTEST_RUN_SUMMARY.md](../MAINTEST_RUN_SUMMARY.md)** - Test suite summary

### What MAINTEST Prevents

**Production Issues Caught:**
- ❌ Missing RLS policies → App completely broken
- ❌ Wrong RLS permissions → 401 errors everywhere
- ❌ Case sensitivity bugs → "Game not found" errors
- ❌ Disabled buttons → Re-analyze broken
- ❌ Frontend DB access issues → Match history empty

**Before MAINTEST:**
- Tests passed ✅
- App was broken in production ❌

**With MAINTEST:**
- Tests fail when app is broken ✅
- Production issues caught before deployment ✅

---

**Last Updated:** October 21, 2025
**Status:** Production-ready
