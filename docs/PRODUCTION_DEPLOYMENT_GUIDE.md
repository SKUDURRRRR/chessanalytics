# Chess Analytics - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Chess Analytics application to production with all reliability, security, and performance optimizations.

## Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+ with pip
- Supabase account and project
- Stockfish engine binary
- Domain name and SSL certificate (for production)

## Architecture Summary

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   (React/Vite)  │    │   (Python/FastAPI)│   │   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. PGN Upload         │                       │
         ├──────────────────────►│                       │
         │                       │ 2. Store Game Data    │
         │                       ├──────────────────────►│
         │                       │ 3. Queue Analysis     │
         │                       ├──────────────────────►│
         │                       │ 4. Stockfish Analysis │
         │                       │◄──────────────────────┤
         │                       │ 5. Store Results      │
         │                       ├──────────────────────►│
         │ 6. Fetch Results      │                       │
         │◄──────────────────────┤                       │
         │ 7. Render UI          │                       │
         │                       │                       │
```

## Critical Fixes Applied

### 1. Data Model Consistency
- ✅ Fixed `accuracy` vs `best_move_percentage` field inconsistency
- ✅ Standardized data types (REAL vs FLOAT)
- ✅ Created unified_analyses view for consistent data access
- ✅ Added proper constraints and indexes

### 2. Reliable Analysis Persistence
- ✅ Implemented idempotent analysis jobs with retry logic
- ✅ Added progress tracking and job monitoring
- ✅ Created analysis_jobs table for reliable persistence
- ✅ Implemented atomic database operations

### 3. Security & RLS
- ✅ Fixed RLS policies to prevent unauthorized access
- ✅ Removed dangerous anon permissions
- ✅ Implemented proper service_role isolation
- ✅ Added comprehensive security logging

### 4. Performance Optimization
- ✅ Created performance profiles (dev/prod/high-perf/cost-optimized)
- ✅ Optimized Stockfish engine settings
- ✅ Implemented parallel processing with limits
- ✅ Added memory and resource management

## Deployment Steps

### 1. Database Setup

```bash
# Apply all migrations in order
supabase db push

# Verify migrations applied
supabase db diff

# Run data consistency validation
psql -h your-supabase-host -U postgres -d postgres -c "SELECT * FROM validate_data_consistency();"

# Run RLS security validation
psql -h your-supabase-host -U postgres -d postgres -c "SELECT * FROM validate_rls_security();"
```

### 2. Environment Configuration

Create `.env` file with production values:

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com


# Security
AUDIT_ENABLED=true
ENCRYPT_LOGS=false
LOG_RETENTION_DAYS=30
JWT_SECRET=your-secure-jwt-secret

# Stockfish
STOCKFISH_PATH=/path/to/stockfish
STOCKFISH_THREADS=2
STOCKFISH_HASH_SIZE=64
```

### 3. Backend Deployment

```bash
# Install dependencies
cd python
pip install -r requirements.txt

# Run tests
python -m pytest tests/test_production_readiness.py -v

# Start backend with production config
python -m uvicorn core.unified_api_server:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4. Frontend Deployment

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test production build
npm run preview

# Deploy to your hosting platform (Vercel, Netlify, etc.)
```

### 5. Stockfish Engine Setup

```bash
# Download Stockfish binary
wget https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-20.04-x86-64-avx2

# Make executable
chmod +x stockfish-ubuntu-20.04-x86-64-avx2

# Move to project directory
mv stockfish-ubuntu-20.04-x86-64-avx2 stockfish/stockfish

# Test Stockfish
./stockfish/stockfish
```

## Production Monitoring

### 1. Health Checks

```bash
# API Health
curl https://your-api-domain.com/health

# Database Health
curl https://your-api-domain.com/health/db

# Analysis Queue Health
curl https://your-api-domain.com/health/queue
```

### 2. Log Monitoring

```bash
# Security logs
tail -f security.log

# Application logs
tail -f app.log

# Error logs
tail -f error.log
```

### 3. Database Monitoring

```sql
-- Check analysis job status
SELECT status, COUNT(*) FROM analysis_jobs GROUP BY status;

-- Check data consistency
SELECT * FROM validate_data_consistency();

-- Check RLS security
SELECT * FROM validate_rls_security();

-- Monitor performance
SELECT * FROM pg_stat_activity WHERE state = 'active';
```


## Security Checklist

- ✅ RLS policies properly configured
- ✅ Service role isolated from user access
- ✅ Anon role has read-only access only
- ✅ Security logging enabled
- ✅ Input validation implemented
- ✅ Rate limiting configured
- ✅ Audit trail complete

## Maintenance Tasks

### Daily
- Monitor analysis queue status
- Check error logs for issues
- Verify data consistency

### Weekly
- Clean up old analysis jobs
- Review security logs
- Check performance metrics

### Monthly
- Update dependencies
- Review and rotate secrets
- Analyze usage patterns

## Troubleshooting

### Common Issues

1. **Analysis Jobs Stuck**
   ```sql
   -- Check stuck jobs
   SELECT * FROM analysis_jobs WHERE status = 'in_progress' AND updated_at < NOW() - INTERVAL '1 hour';
   
   -- Reset stuck jobs
   UPDATE analysis_jobs SET status = 'pending' WHERE status = 'in_progress' AND updated_at < NOW() - INTERVAL '1 hour';
   ```

2. **Database Connection Issues**
   ```bash
   # Check connection pool
   curl https://your-api-domain.com/health/db
   
   # Restart backend
   systemctl restart chess-analytics-api
   ```

3. **Stockfish Engine Issues**
   ```bash
   # Test Stockfish
   ./stockfish/stockfish
   
   # Check permissions
   ls -la stockfish/stockfish
   ```

### Performance Issues

1. **Slow Analysis**
   - Reduce Stockfish depth
   - Increase concurrent workers
   - Check memory usage

2. **Database Slowdown**
   - Check index usage
   - Analyze query performance
   - Consider connection pooling

## Backup and Recovery

### Database Backup
```bash
# Create backup
pg_dump -h your-supabase-host -U postgres -d postgres > backup.sql

# Restore backup
psql -h your-supabase-host -U postgres -d postgres < backup.sql
```

### Application Backup
```bash
# Backup application data
tar -czf chess-analytics-backup.tar.gz /path/to/application

# Backup configuration
cp .env .env.backup
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple API instances
- Implement Redis for job queue
- Use CDN for static assets

### Vertical Scaling
- Increase server resources
- Optimize database configuration
- Tune Stockfish parameters

## Support and Monitoring

### Log Files
- `security.log` - Security events and audit trail
- `app.log` - Application logs
- `error.log` - Error logs
- `analysis.log` - Analysis-specific logs

### Metrics to Monitor
- Analysis completion rate
- Average analysis time
- Database query performance
- Memory usage
- CPU usage
- Error rates

### Alerting
Set up alerts for:
- High error rates
- Analysis queue backlog
- Database connection issues
- Security events
- Performance degradation

## Conclusion

The Chess Analytics application is now production-ready with:
- ✅ Reliable data persistence
- ✅ Comprehensive security
- ✅ Performance optimization
- ✅ Monitoring and logging
- ✅ Error handling and retry logic
- ✅ Data consistency validation

Follow this guide for a successful production deployment.
