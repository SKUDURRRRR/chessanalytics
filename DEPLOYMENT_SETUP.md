# Environment Variables Setup Guide

## Required Environment Variables

Your chess analytics application now requires the following environment variables to be set:

### Frontend (React/Vite)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ANALYSIS_API_URL=http://localhost:8002
```

### Backend (Python/FastAPI)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
STOCKFISH_PATH=stockfish
API_HOST=127.0.0.1
API_PORT=8002
```

## Setup Methods

### Method 1: Local Development (.env files)

#### Frontend Setup
1. Copy the example file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your actual values:
   ```bash
   # .env
   VITE_SUPABASE_URL=https://nkeaifrhtyigfmicfwch.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZWFpZnJodHlpZ2ZtaWNmd2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMzcxMDEsImV4cCI6MjA3MzYxMzEwMX0.xl_IHUFUAMaOiiMSnDLWVFEi_JujwbJ26-Uj-wwJkbs
   VITE_ANALYSIS_API_URL=http://localhost:8002
   ```

#### Backend Setup
1. Copy the example file:
   ```bash
   cp python/env.example python/.env
   ```

2. Edit `python/.env` with your actual values:
   ```bash
   # python/.env
   SUPABASE_URL=https://nkeaifrhtyigfmicfwch.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZWFpZnJodHlpZ2ZtaWNmd2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMzcxMDEsImV4cCI6MjA3MzYxMzEwMX0.xl_IHUFUAMaOiiMSnDLWVFEi_JujwbJ26-Uj-wwJkbs
   STOCKFISH_PATH=stockfish
   API_HOST=127.0.0.1
   API_PORT=8002
   ```

### Method 2: Production Deployment

#### Vercel Deployment
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add the following variables:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key-here`
   - `VITE_ANALYSIS_API_URL` = `https://your-backend-url.com`

#### Railway/Render Backend
1. Go to your service dashboard
2. Add environment variables:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key-here`
   - `STOCKFISH_PATH` = `stockfish`
   - `API_HOST` = `0.0.0.0`
   - `API_PORT` = `8002`

#### Docker Deployment
Create a `docker-compose.yml`:
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_SUPABASE_URL=https://your-project.supabase.co
      - VITE_SUPABASE_ANON_KEY=your-anon-key-here
      - VITE_ANALYSIS_API_URL=http://backend:8002

  backend:
    build: ./python
    ports:
      - "8002:8002"
    environment:
      - SUPABASE_URL=https://your-project.supabase.co
      - SUPABASE_ANON_KEY=your-anon-key-here
      - STOCKFISH_PATH=stockfish
      - API_HOST=0.0.0.0
      - API_PORT=8002
```

## Verification

### Test Frontend
```bash
npm run dev
# Check browser console for any environment variable errors
```

### Test Backend
```bash
cd python
python main.py
# Should start without "Missing environment variable" errors
```

### Test Database Connection
```bash
# Run health check
npm run health-check
# Should return no errors
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` files** to version control
2. **Use different keys** for development and production
3. **Rotate keys regularly** for security
4. **Use environment-specific** Supabase projects when possible

## Troubleshooting

### Common Issues

1. **"Missing VITE_SUPABASE_URL environment variable"**
   - Check that `.env` file exists in project root
   - Verify variable name is exactly `VITE_SUPABASE_URL`
   - Restart the development server

2. **"Missing SUPABASE_URL environment variable"**
   - Check that `python/.env` file exists
   - Verify variable name is exactly `SUPABASE_URL`
   - Restart the Python server

3. **CORS errors**
   - Ensure `VITE_ANALYSIS_API_URL` points to your backend
   - Check that backend is running on the correct port

4. **Database connection errors**
   - Verify Supabase URL and key are correct
   - Check that your Supabase project is active
   - Ensure RLS policies allow your operations

### Getting Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project
4. Go to Settings → API
5. Copy:
   - **Project URL** → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`

## Next Steps

After setting up environment variables:

1. **Run database migrations**:
   ```bash
   supabase db reset
   ```

2. **Start the application**:
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   cd python
   python main.py
   ```

3. **Test the application**:
   - Go to `http://localhost:3000`
   - Try importing some games
   - Check that analytics work correctly

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the backend logs for errors
3. Verify all environment variables are set correctly
4. Ensure your Supabase project is active and accessible
