# 🚀 Quick Start Guide

## Environment Variables Setup

Your chess analytics app now requires environment variables to be configured. Here's how to set them up quickly:

### Option 1: Automated Setup (Recommended)

**Windows:**
```powershell
# Run PowerShell script
.\setup-env.ps1

# Or run batch file
setup-env.bat
```

**Linux/Mac:**
```bash
# Run shell script
./setup-env.sh
```

**Node.js (Cross-platform):**
```bash
# Run setup script
npm run setup-env
```

### Option 2: Manual Setup

1. **Copy environment files:**
   ```bash
   # Frontend
   copy env.example .env
   
   # Backend
   copy python\env.example python\.env
   ```

2. **Edit the files with your Supabase credentials:**
   - Edit `.env` (frontend)
   - Edit `python\.env` (backend)

## Required Credentials

You need to get these from your Supabase project:

1. Go to [supabase.com](https://supabase.com)
2. Sign in and select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → Use for `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`

## Example Configuration

### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ANALYSIS_API_URL=http://localhost:8002
```

### Backend (python\.env)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STOCKFISH_PATH=stockfish
API_HOST=127.0.0.1
API_PORT=8002
```

## Validation

After setting up, validate your configuration:

```bash
npm run validate-env
```

This will check that all required environment variables are properly set.

## Running the Application

1. **Start the backend:**
   ```bash
   cd python
   python main.py
   ```

2. **Start the frontend (in a new terminal):**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Go to `http://localhost:3000`
   - The app should load without errors

## Database Setup

After setting up environment variables, run the database migrations:

```bash
# Reset database with new schema
supabase db reset

# Or apply migrations to existing database
supabase migration up
```

## Troubleshooting

### Common Issues

1. **"Missing environment variable" errors:**
   - Run `npm run validate-env` to check configuration
   - Make sure `.env` files exist and have correct values

2. **CORS errors:**
   - Ensure backend is running on port 8002
   - Check that `VITE_ANALYSIS_API_URL` points to your backend

3. **Database connection errors:**
   - Verify Supabase URL and key are correct
   - Check that your Supabase project is active

### Getting Help

- Check the browser console for errors
- Check the backend terminal for errors
- Run `npm run validate-env` to verify configuration
- See `DEPLOYMENT_SETUP.md` for detailed instructions

## Next Steps

Once everything is working:

1. **Import some games** to test the analytics
2. **Check the database** to ensure data is being stored
3. **Explore the features** like personality analysis
4. **Deploy to production** using your preferred platform

## Security Notes

⚠️ **Important:**
- Never commit `.env` files to version control
- Use different credentials for development and production
- Rotate your Supabase keys regularly

---

**Need help?** Check `DEPLOYMENT_SETUP.md` for detailed instructions or run `npm run validate-env` to diagnose issues.
