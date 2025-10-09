# Supabase Project Setup

## Environment Configuration

Create a `.env` file in the project root with the following content:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database URL for health checks and migrations
# You'll need to get the database password from your Supabase dashboard
DATABASE_URL=postgresql://postgres:[YOUR_DB_PASSWORD]@db.your-project.supabase.co:5432/postgres
```

## Database Setup

### 1. Run Migrations

You need to run the database migrations to set up the schema:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 2. Manual Migration (Alternative)

If you prefer to run migrations manually, execute these SQL files in order:

1. `supabase/migrations/20240101000000_initial_schema.sql`
2. `supabase/migrations/20240102000000_enhance_games_schema.sql`
3. `supabase/migrations/20240103000000_add_upsert_function.sql`
4. `supabase/migrations/20240104000000_add_performance_indexes.sql`

### 3. Deploy Edge Functions

Deploy the analytics and import-games functions:

```bash
# Deploy analytics function
supabase functions deploy analytics

# Deploy import-games function
supabase functions deploy import-games
```

## Testing the Setup

### 1. Run the Application

```bash
npm run dev
```

The app should now connect to your Supabase project and be available at `http://localhost:3000`.

### 2. Test Health Checks

```bash
# Set database URL (replace with your actual password)
export DATABASE_URL="postgresql://postgres:[YOUR_PASSWORD]@db.your-project-id.supabase.co:5432/postgres"

# Run health checks
npm run health-check
```

### 3. Test Analytics

1. Go to `http://localhost:3000`
2. Enter a test user ID (e.g., "testuser")
3. The analytics should load (may show empty data initially)

### 4. Test Import

1. Go to the "Import Games" tab
2. Enter a Lichess username
3. Click "Import Games" to test the import function

## Troubleshooting

### Connection Issues

If you see "Failed to send a request to the Edge Function":
- Check that the edge functions are deployed
- Verify the service role key is correct
- Ensure RLS policies allow the operations

### Database Issues

If health checks fail:
- Verify migrations were run successfully
- Check that the database password is correct
- Ensure the database URL is properly formatted

### Function Issues

If analytics/import functions fail:
- Check the function logs in Supabase dashboard
- Verify the service role key has proper permissions
- Ensure the database schema matches the function expectations

## Next Steps

1. **Set up RLS policies** for production security
2. **Configure authentication** if needed
3. **Set up monitoring** for the edge functions
4. **Configure backups** for the database
5. **Set up CI/CD** with the provided GitHub Actions workflow

## Security Notes

- Never commit the `.env` file to version control
- Rotate the service role key regularly
- Use environment-specific configurations
- Monitor function usage and database queries
