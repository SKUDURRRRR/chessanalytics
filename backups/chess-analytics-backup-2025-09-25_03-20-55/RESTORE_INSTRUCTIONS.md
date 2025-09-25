# Chess Analytics Restore Instructions

## Prerequisites
Before restoring this backup, ensure you have:
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Git
- Supabase CLI
- A Supabase project (or create a new one)

## Step 1: Restore Project Structure
1. Create a new directory for your project
2. Copy all files from this backup to the new directory
3. Navigate to the project directory

## Step 2: Environment Setup
1. Copy `env.example` to `.env`
2. Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ANALYSIS_API_URL=http://localhost:8002
   ```

## Step 3: Database Setup
1. Install Supabase CLI: `npm install -g supabase`
2. Initialize Supabase: `supabase init`
3. Link to your project: `supabase link --project-ref your-project-ref`
4. Apply migrations: `supabase db push`

## Step 4: Backend Setup
1. Navigate to `python/` directory
2. Create virtual environment: `python -m venv venv`
3. Activate virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `python/.env` and configure your environment variables

## Step 5: Frontend Setup
1. Install Node.js dependencies: `npm install`
2. Run type checking: `npm run typecheck`
3. Run linting: `npm run lint`

## Step 6: Stockfish Setup
1. Ensure Stockfish executable is in the `stockfish/` directory
2. The executable should be: `stockfish/stockfish-windows-x86-64-avx2.exe`

## Step 7: Start the Application
1. Start the backend: `npm run start:backend` or run `start-backend.ps1`
2. Start the frontend: `npm run dev`
3. Open browser to `http://localhost:3000`

## Step 8: Verify Installation
1. Check that the frontend loads without errors
2. Verify backend API is responding at `http://localhost:8002`
3. Test database connection through the application
4. Run tests: `npm test`

## Troubleshooting

### Common Issues
- **Environment variables not loaded:** Ensure `.env` files are in the correct locations
- **Database connection failed:** Verify Supabase credentials and project status
- **Stockfish not found:** Check that the executable is in the correct location
- **Port conflicts:** Ensure ports 3000 and 8002 are available

### Getting Help
- Check the documentation in `docs/` directory
- Review `QUICK_START.md` for quick setup
- Check `SECURITY_NOTES.md` for security considerations

## Post-Restore Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Backend API running
- [ ] Frontend application loading
- [ ] Stockfish engine accessible
- [ ] Tests passing
- [ ] Documentation accessible

## Backup Information
- **Backup Date:** 2025-09-25 03:20:55
- **Project Version:** 1.0.0
- **Database Migrations:** 20 files
- **Dependencies:** See package.json and requirements.txt
