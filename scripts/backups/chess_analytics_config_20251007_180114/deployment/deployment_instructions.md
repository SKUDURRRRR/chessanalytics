# Chess Analytics Deployment Instructions

## Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Supabase account and project
- Stockfish engine

## Environment Setup
1. Copy `env.example` to `.env`
2. Fill in your Supabase credentials
3. Set `APP_ENV` to 'production' for production deployment

## Frontend Deployment (Vercel)
1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Deploy to Vercel: `vercel --prod`

## Backend Deployment (Docker)
1. Build the Docker image: `docker build -f Dockerfile.api -t chess-analytics-api .`
2. Run with Docker Compose: `docker-compose -f docker-compose.api.yml up -d`

## Manual Backend Setup
1. Install Python dependencies: `pip install -r requirements.txt`
2. Set environment variables
3. Run the API server: `python python/main.py`

## Database Setup
1. Run Supabase migrations: `supabase db push`
2. Verify database schema is up to date

## Verification
1. Check API health: `curl http://localhost:8002/health`
2. Check frontend: Open browser to deployed URL
3. Test analysis functionality

## Troubleshooting
- Check logs for errors
- Verify environment variables
- Ensure Stockfish is accessible
- Check database connectivity
