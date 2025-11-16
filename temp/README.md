# Temporary Files Directory

This directory contains temporary files, test outputs, and ephemeral data that are not part of the application source code.

## What's Stored Here

- **Test Results** - JSON output from test runs
- **Log Dumps** - Vercel logs, backend logs, debugging output
- **Sample Data** - Temporary game data for testing
- **Build Artifacts** - Temporary build outputs
- **Diagnostic Files** - Debug dumps and diagnostic output

## Important Notes

⚠️ **Git Ignored:** This entire directory is in `.gitignore` and will NOT be committed to version control.

🗑️ **Safe to Delete:** All files in this directory can be safely deleted at any time. They are regenerated as needed.

📁 **Auto-Created:** This directory is created automatically by the application and build processes.

## Cleanup

To clean up temporary files:

```bash
# Windows PowerShell
Remove-Item temp\* -Recurse -Force

# Linux/Mac
rm -rf temp/*
```

Or simply delete the entire `temp/` folder and it will be recreated as needed.

## What NOT to Store Here

❌ **Source Code** - Use `src/` or `python/`
❌ **Configuration** - Use config files in root or `python/`
❌ **Documentation** - Use `docs/`
❌ **Production Data** - Use database or proper storage
❌ **API Keys or Secrets** - Use `.env.local` files (also gitignored)

## File Retention

Files in this directory are:
- Generated during development/testing
- Not needed for production deployment
- Can be recreated from source code
- Should be cleaned up periodically to save disk space

## Typical Contents

```
temp/
├── comprehensive_test_results_*.json  # Test run outputs
├── vercel_logs_*.json                 # Downloaded Vercel logs
├── external_chess_com_oct.json        # Sample chess.com data
├── game_analyses_sample.json          # Test game analyses
├── MAINTEST_*.html                    # Test result reports
└── diff.txt                           # File comparison outputs
```

## See Also

- **logs/** - Application log files (also gitignored)
- **test-results/** - Playwright test results
- **coverage/** - Test coverage reports
