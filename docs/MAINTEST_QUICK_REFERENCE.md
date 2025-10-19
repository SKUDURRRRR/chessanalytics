# MAINTEST Quick Reference

## 🚀 Quick Commands

```bash
# Before committing code
python run_MAINTEST.py --quick

# Before pushing to production
python run_MAINTEST.py --full

# Test only backend changes
python run_MAINTEST.py --backend-only

# Test only frontend changes
python run_MAINTEST.py --frontend-only

# Ignore security failures (not recommended)
python run_MAINTEST.py --quick --ignore-security
```

## ✅ Pre-flight Checklist

Before running MAINTEST, ensure:

- [ ] Backend is running on http://localhost:8002
- [ ] Frontend is running on http://localhost:3000
- [ ] `.env` file exists with all credentials
- [ ] Test data exists (penkinisShachmatistas, skudurelis)
- [ ] Stockfish is accessible

## 📊 What Success Looks Like

```
================================================================================
✅ ALL TESTS PASSED - READY FOR PRODUCTION
================================================================================
```

## ❌ What Failure Looks Like

```
================================================================================
❌ SOME TESTS FAILED - DO NOT DEPLOY TO PRODUCTION
================================================================================
```

## 🔍 Reading Test Results

### Console Output

- ✅ = Test passed
- ❌ = Test failed
- ⏭️ = Test skipped
- ⚠️ = Warning

### HTML Report

Open `MAINTEST_results_YYYYMMDD_HHMMSS.html` in browser for:
- Visual summary
- Detailed test results
- Timing information
- Error details

## 🐛 Common Issues & Fixes

| Error | Fix |
|-------|-----|
| Backend not running | `cd python && python main.py` |
| Frontend not running | `npm run dev` |
| Missing .env | `cp env.example .env` and edit |
| Stockfish not found | Set `STOCKFISH_PATH` in .env |
| Playwright not installed | `npx playwright install` |
| Tests timeout | Check backend/frontend are responsive |

## 📝 Test Coverage

### Security (6 tests)
- Environment variables exist ✓
- No placeholder values ✓
- No exposed secrets ✓
- Stockfish accessible ✓
- RLS anonymous blocked ✓
- RLS service role access ✓

### Game Import (4 tests)
- Lichess import ✓
- Chess.com import ✓
- Smart import ✓
- Duplicate prevention ✓

### Game Analysis (2 tests)
- Bulk analysis ✓
- Single game analysis ✓

### Data Correctness (4 tests)
- Games table has data ✓
- Accuracy values valid ✓
- Opening names present ✓
- Personality scores valid ✓

### Frontend (10+ tests)
- Player search (Lichess & Chess.com) ✓
- Analytics page display ✓
- Match history ✓
- Game analysis page ✓
- Full integration flow ✓

## ⏱️ Expected Duration

| Mode | Duration | Use Case |
|------|----------|----------|
| Quick | 2-3 min | Before commits |
| Full | 10-15 min | Before production |
| Backend only | 3-5 min | Backend changes |
| Frontend only | 5-8 min | Frontend changes |

## 🎯 When to Run

### Always Run (Quick)
- Before committing code
- Before creating PR
- After fixing bugs

### Always Run (Full)
- Before pushing to production
- After major feature changes
- Before tagging releases

### Consider Running
- After dependency updates
- Weekly validation
- After environment changes

## 📧 Reporting Failures

If tests fail:

1. Check console output for specific failure
2. Review HTML report for details
3. Fix the issue
4. Re-run tests
5. Only deploy if ALL tests pass

**Never ignore test failures in production deployments!**

## 🔒 Security First

Security test failures are **critical**:

- Don't use `--ignore-security` in production
- Fix security issues immediately
- Re-run tests after fixes
- Document any security exceptions

## 💡 Tips

- Run quick mode frequently during development
- Run full mode before every production push
- Save HTML reports for comparison
- Monitor test duration for performance regression
- Update test users if they become inactive
- Keep credentials up to date

## 🎓 Learning More

See `MAINTEST_README.md` for:
- Complete documentation
- Detailed troubleshooting
- Configuration options
- CI/CD integration
- File structure

## 📞 Support

1. Check error message
2. Review HTML report
3. See MAINTEST_README.md
4. Check individual test files
5. Verify environment setup

