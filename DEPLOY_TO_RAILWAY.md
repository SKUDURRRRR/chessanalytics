# Deploy Chess Analytics to Railway - Quick Start Guide

## Why Railway?

✅ **3-5x faster** than Render free tier (0.3-0.5 CPU vs 0.1 CPU)  
✅ **No auto-sleep** (no cold starts)  
✅ **$5 free credit** per month  
✅ **Usage-based pricing** (~$3-8/month for MVP)  
✅ **You already have the config** (railway.toml ready)

---

## Prerequisites

- Git repository on GitHub
- Railway account (free to sign up)
- 15 minutes

---

## Step 1: Install Railway CLI (2 minutes)

### **Option A: Using npm (recommended)**
```bash
npm install -g @railway/cli
```

### **Option B: Using curl**
```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex
```

### **Verify Installation**
```bash
railway --version
```

---

## Step 2: Login to Railway (1 minute)

```bash
railway login
```

This will open your browser to authenticate.

---

## Step 3: Initialize Railway Project (2 minutes)

### **From Your Project Root**
```bash
cd "C:\my files\Projects\chess-analytics"

# Initialize Railway project
railway init
```

**Select options:**
- **Project name**: chess-analytics (or your preferred name)
- **Environment**: production

---

## Step 4: Link to GitHub (Optional but Recommended)

### **Option A: Deploy from GitHub**
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin development
   ```

2. In Railway dashboard:
   - Go to your project
   - Click "New" → "GitHub Repo"
   - Select your repository
   - Select branch: `development`

### **Option B: Deploy Directly (Faster for Testing)**
```bash
railway up
```

---

## Step 5: Configure Environment Variables (5 minutes)

### **Go to Railway Dashboard**
1. Open https://railway.app/dashboard
2. Select your project
3. Click on your service
4. Go to **Variables** tab

### **Add These Variables**

```bash
# Required: Stockfish
STOCKFISH_PATH=stockfish

# Required: Supabase (copy from your .env)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Required: API Configuration
API_HOST=0.0.0.0
API_PORT=$PORT
CORS_ORIGINS=*

# Optional: Deployment Tier (auto-detected if not set)
DEPLOYMENT_TIER=starter

# Optional: Performance Settings
PYTHONPATH=/app/python
PYTHON_VERSION=3.11
```

### **Copy Variables from Render (if migrating)**
```bash
# In your Render dashboard, copy all environment variables
# Paste them into Railway's Variables tab
```

---

## Step 6: Deploy (1 minute)

### **If Using GitHub**
- Railway will auto-deploy when you push to GitHub
- Watch the build logs in the Railway dashboard

### **If Using Direct Deploy**
```bash
railway up
```

### **Monitor Deployment**
```bash
railway logs
```

---

## Step 7: Verify Deployment (2 minutes)

### **Get Your App URL**
```bash
railway domain
```

Or find it in the Railway dashboard under **Settings** → **Domains**

### **Test the API**
```bash
# Replace with your Railway URL
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "stockfish": "available",
  "version": "1.0.0"
}
```

### **Test Analysis**
```bash
# Test single game analysis
curl -X POST https://your-app.railway.app/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test",
    "platform": "lichess",
    "analysis_type": "stockfish",
    "limit": 1
  }'
```

---

## Step 8: Update Frontend (2 minutes)

### **Update Your .env File**
```bash
# .env or .env.local
VITE_ANALYSIS_API_URL=https://your-app.railway.app
```

### **Or Update in Code**
```typescript
// src/services/api.ts
const API_URL = process.env.VITE_ANALYSIS_API_URL || 
                'https://your-app.railway.app';
```

---

## Troubleshooting

### **Build Failed: Stockfish Not Found**

**Check `nixpacks.toml` at project root:**
```toml
[phases.setup]
nixPkgs = ["python311", "stockfish"]

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "cd python && uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### **Error: Module Not Found**

**Check `PYTHONPATH` environment variable:**
```bash
PYTHONPATH=/app/python
```

**Check `railway.toml` start command:**
```toml
[deploy]
startCommand = "cd /app/python && uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### **500 Error: Supabase Connection Failed**

**Verify environment variables:**
```bash
railway variables
```

**Check Supabase URL format:**
```bash
# Should be:
SUPABASE_URL=https://xxxxx.supabase.co
# NOT:
SUPABASE_URL=https://xxxxx.supabase.co/
```

### **Timeout or Slow Performance**

**Check if using free tier config:**
```bash
# In Railway dashboard, add:
DEPLOYMENT_TIER=starter
```

**Monitor resource usage:**
- Go to Railway dashboard
- Click on your service
- Go to **Metrics** tab
- Check CPU and Memory usage

---

## Cost Monitoring

### **View Current Usage**
1. Go to Railway dashboard
2. Click on your project name
3. Go to **Usage** tab
4. See current month's costs

### **Set Budget Alerts**
1. Go to **Settings** → **Usage Alerts**
2. Set alert at $3 (60% of free credit)
3. Set alert at $5 (100% of free credit)

### **Estimate Monthly Cost**
```
$5 free credit covers approximately:
- 50-100 game analyses
- ~500 hours of runtime
- ~100 GB egress

Expected costs:
- Month 1-2: $0 (within free credit)
- Month 3-4: $3-8 (with moderate usage)
- Month 5+: $8-15 (growing user base)
```

---

## Performance Optimization

### **Enable Deployment Tier Config**
```bash
# In Railway dashboard, set:
DEPLOYMENT_TIER=starter
```

This uses the optimized configuration from `python/core/config_free_tier.py`:
- Analysis depth: 10 (vs 12 default)
- Time limit: 0.4s per position
- Max concurrent: 2 analyses
- Hash size: 32 MB

### **Monitor Analysis Times**
```bash
# Check logs for performance
railway logs --tail 100

# Look for:
# "[Config] Using STARTER tier configuration"
# "Analysis completed in X seconds"
```

---

## Scaling on Railway

### **When to Scale?**

**Scale UP when:**
- Analysis times > 2 minutes consistently
- CPU usage > 80%
- Memory usage > 400 MB
- Multiple users complaining about speed

**Scale DOWN when:**
- Costs > $15/month
- Low user activity
- Analysis times < 30 seconds

### **How to Scale**

**Option 1: Vertical Scaling (More Resources)**
1. Go to Railway dashboard
2. Select your service
3. Go to **Settings** → **Resources**
4. Adjust CPU and Memory sliders

**Option 2: Horizontal Scaling (More Instances)**
```bash
# Add more replicas
railway settings --replicas 2
```

---

## Rollback (If Something Goes Wrong)

### **Rollback to Previous Deployment**
```bash
# List deployments
railway deployments

# Rollback to specific deployment
railway rollback <deployment-id>
```

### **Or in Dashboard**
1. Go to your service
2. Click **Deployments** tab
3. Find working deployment
4. Click **Rollback**

---

## Useful Commands

```bash
# View logs
railway logs

# Follow logs (live)
railway logs --follow

# View environment variables
railway variables

# Add a variable
railway variables set KEY=value

# Open dashboard
railway open

# Check service status
railway status

# Restart service
railway restart

# SSH into container (for debugging)
railway shell
```

---

## Comparison: Before vs After

### **On Render Free Tier**
- Single game analysis: **3-7 minutes**
- CPU: 0.1 (10% of core)
- Auto-sleep: Yes (60s cold start)
- Cost: $0

### **On Railway**
- Single game analysis: **1-2 minutes** ⚡ (3-5x faster)
- CPU: ~0.3-0.5 (shared)
- Auto-sleep: No (always warm)
- Cost: $3-8/month

**Result: 3-5x faster for ~$5/month** 🎉

---

## Next Steps

1. ✅ **Deploy to Railway** (follow steps above)
2. ✅ **Test with real games** (verify analysis quality)
3. ✅ **Update frontend** (point to new API URL)
4. ✅ **Monitor costs** (set up budget alerts)
5. ✅ **Share with users** (get feedback)
6. ⏰ **Week 2**: Evaluate performance vs cost
7. ⏰ **Month 2**: Decide if staying on Railway or adjusting

---

## Support

### **Railway Issues**
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Support: support@railway.app

### **Your Chess Analytics Issues**
- Check logs: `railway logs`
- Review config: `python/core/config_free_tier.py`
- Verify environment variables in dashboard

---

## Quick Reference Card

```bash
# Deploy
railway up

# Logs
railway logs --follow

# Variables
railway variables

# Restart
railway restart

# Dashboard
railway open

# Status
railway status
```

**Your Railway URL**: `https://your-app.railway.app`  
**Dashboard**: https://railway.app/dashboard  
**Docs**: https://docs.railway.app

---

**Ready to deploy?** Run `railway login` to get started! 🚀

