# Deployment Strategy & Branch Alignment

## Current Setup ✅

Both `master` and `development` branches are now **synchronized** (as of commit `c7c5036`).

### Branch Configuration

- **`master`**: Production branch (deploys to Vercel frontend)
- **`development`**: Development/staging branch (can deploy to backend services)

## Deployment Services

### Frontend (Vercel)
- **Deploys from**: `master` branch
- **URL**: chessdata.app
- **Auto-deploys**: Yes (on push to master)

### Backend (Railway/Render)
- **Current branch**: Check your Railway/Render dashboard
- **Recommended**: Deploy from `master` for production
- **Alternative**: Use `development` for staging environment

## Recommended Workflow

### For Feature Development:

1. **Work on `development` branch**
   ```bash
   git checkout development
   # Make changes
   git add .
   git commit -m "feat: your feature"
   git push origin development
   ```

2. **Test thoroughly** on development environment

3. **Merge to `master` when ready for production**
   ```bash
   git checkout master
   git merge development
   git push origin master
   ```

4. **Both frontend and backend deploy automatically**

### For Quick Fixes (Current Approach):

1. **Work directly on `master`**
   ```bash
   git checkout master
   # Make changes
   git add .
   git commit -m "fix: quick fix"
   git push origin master
   ```

2. **Sync `development` to keep branches aligned**
   ```bash
   git checkout development
   git merge master
   git push origin development
   ```

## Branch Alignment Status

As of **January 8, 2025**:
- ✅ `master` and `development` are **fully synchronized**
- ✅ Latest commit: `c7c5036` (Timeline badge layout improvements)
- ✅ Both branches have all recent fixes:
  - Move timeline scrolling fix
  - Keyboard navigation
  - Badge padding improvements

## Configuration Files to Check

### Backend Deployment Configuration:

1. **Railway**: Check `railway.toml` or Railway dashboard for branch setting
2. **Render**: Check `render.yaml` or Render dashboard for branch setting
3. **Vercel**: Already configured to deploy from `master`

### How to Check Backend Branch:

**Railway:**
- Go to Railway dashboard
- Select your project
- Go to Settings → Deploy
- Check "Production Branch" setting
- **Recommendation**: Set to `master`

**Render:**
- Go to Render dashboard
- Select your service
- Go to Settings
- Check "Branch" under "Build & Deploy"
- **Recommendation**: Set to `master`

## Best Practices Going Forward

### Option 1: Production-Only Workflow (Simplest)
- Use `master` for everything
- Both frontend and backend deploy from `master`
- Test locally before pushing

### Option 2: Development/Production Workflow (Recommended)
- Use `development` for daily work and testing
- Merge to `master` only when ready for production
- Set up separate backend instances:
  - **Production backend**: Deploys from `master`
  - **Staging backend** (optional): Deploys from `development`

### Option 3: Proper CI/CD (Advanced)
- Use `development` for active development
- Use pull requests to merge to `master`
- Set up automated testing
- Deploy to staging first, then production

## Current Status Summary

✅ **What's Working:**
- Both branches are synced
- Frontend deploys automatically from `master`
- All recent fixes are in both branches

⚠️ **Action Needed:**
- Check your Railway/Render backend configuration
- Ensure backend deploys from `master` (or set up staging from `development`)
- Document which environment each service uses

## Quick Reference

**To sync branches after working on master:**
```bash
git checkout master
# ... make changes ...
git push origin master

# Sync development
git checkout development
git merge master
git push origin development
```

**To sync branches after working on development:**
```bash
git checkout development
# ... make changes ...
git push origin development

# Merge to master when ready
git checkout master
git merge development
git push origin master
```

---

**Last Updated**: January 8, 2025
**Current Strategy**: Quick fixes on `master`, sync to `development` immediately

