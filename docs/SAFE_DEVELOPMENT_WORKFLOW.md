# Safe Development Workflow for Chess Analytics

## 🎯 Current Setup
- **Frontend (Vercel)**: Auto-deploys from `master` → chessdata.app
- **Backend (Railway)**: Auto-deploys from `master` → API
- **Development Branch**: `development` (for safe testing)

## 🚀 Safe Development Process

### For Bug Fixes & Small Features:

1. **Start from development branch:**
   ```bash
   git checkout development
   git pull origin development
   ```

2. **Make your changes:**
   - Edit files, fix bugs, add features
   - Test locally: `npm run dev` and `cd python && python main.py`

3. **Commit to development:**
   ```bash
   git add .
   git commit -m "fix: description of your fix"
   git push origin development
   ```

4. **When ready for production:**
   ```bash
   git checkout master
   git pull origin master
   git merge development
   git push origin master
   ```

5. **Both services auto-deploy!** 🎉

### For Larger Features:

1. **Create feature branch:**
   ```bash
   git checkout development
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit:**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request on GitHub:**
   - Go to GitHub
   - Create PR: `feature/your-feature-name` → `development`
   - Review and merge

4. **Deploy to production:**
   ```bash
   git checkout master
   git merge development
   git push origin master
   ```

## 🛡️ Safety Checklist

### Before Pushing to Master:
- [ ] Tested locally (frontend + backend)
- [ ] No breaking API changes
- [ ] Small, focused changes
- [ ] Reviewed with `git diff`

### Emergency Rollback:
```bash
git checkout master
git reset --hard HEAD~1
git push origin master --force
```

## 🔄 Branch Sync (Keep Both Branches Updated)

### After working on master:
```bash
git checkout development
git merge master
git push origin development
```

### After working on development:
```bash
git checkout master
git merge development
git push origin master
```

## 📝 Commit Message Convention
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `style:` - Code style changes

## 🚨 Important Notes
- **Never push directly to master** without testing
- **Always test locally first**
- **Keep changes small** for easier rollback
- **Both services deploy automatically** from master
- **Use development branch** for safe testing

---
**Last Updated**: January 8, 2025
**Status**: Ready for safe development! ✅
