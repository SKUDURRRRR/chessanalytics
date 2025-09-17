# Deployment Guide - Unified Chess Analysis System

This guide covers deploying the unified chess analysis system to production environments.

## 🚀 Production Deployment Overview

The unified system can be deployed in various configurations:
- **Single Server**: All components on one machine
- **Microservices**: Separate services for different components
- **Containerized**: Docker containers for easy deployment
- **Cloud**: AWS, Azure, Google Cloud, or other cloud providers

## 📋 Prerequisites

### System Requirements

- **Python 3.8+**
- **Memory**: 2GB+ RAM (4GB+ recommended for Stockfish)
- **Storage**: 1GB+ free space
- **CPU**: 2+ cores (4+ cores recommended for concurrent analysis)
- **Network**: Internet access for database connectivity

### Dependencies

```bash
# Core dependencies
pip install fastapi uvicorn supabase python-chess

# Optional dependencies
pip install chess-engine  # For advanced Stockfish integration
pip install psutil       # For system monitoring
pip install gunicorn     # For production WSGI server
```

### External Services

- **Supabase Database**: Configured and accessible
- **Stockfish Engine**: Installed and accessible (optional)
- **Domain/DNS**: For production URLs (optional)

## 🔧 Environment Configuration

### 1. Environment Variables

Create a `.env` file for production:

```bash
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stockfish Configuration
STOCKFISH_PATH=/usr/local/bin/stockfish
STOCKFISH_DEPTH=15
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_TIME_LIMIT=2.0

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4
API_TIMEOUT=300
API_MAX_REQUEST_SIZE=10485760

# Analysis Configuration
ANALYSIS_DEFAULT_TYPE=stockfish
ANALYSIS_BATCH_SIZE=10
ANALYSIS_MAX_GAMES=100
ANALYSIS_PARALLEL=true
ANALYSIS_CACHE=true
ANALYSIS_CACHE_TTL=24

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=/var/log/chess-analysis/analysis.log
LOG_MAX_FILE_SIZE=10485760
LOG_BACKUP_COUNT=5

# Security (Production)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SECRET_KEY=your_secret_key_for_jwt_tokens
```

### 2. System Configuration

#### Install Stockfish (Ubuntu/Debian)
```bash
# Install Stockfish
sudo apt update
sudo apt install stockfish

# Verify installation
stockfish --version
```

#### Install Stockfish (CentOS/RHEL)
```bash
# Install EPEL repository
sudo yum install epel-release

# Install Stockfish
sudo yum install stockfish

# Verify installation
stockfish --version
```

#### Install Stockfish (macOS)
```bash
# Using Homebrew
brew install stockfish

# Verify installation
stockfish --version
```

#### Install Stockfish (Windows)
```bash
# Using winget
winget install Stockfish.Stockfish

# Or download from https://stockfishchess.org/download/
```

## 🐳 Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    stockfish \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY python/core/ ./python/core/
COPY python/migrate_to_unified.py ./

# Create logs directory
RUN mkdir -p /var/log/chess-analysis

# Set environment variables
ENV PYTHONPATH=/app
ENV STOCKFISH_PATH=/usr/games/stockfish

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start command
CMD ["python", "python/core/api_server.py"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  chess-analysis-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - STOCKFISH_PATH=/usr/games/stockfish
      - API_HOST=0.0.0.0
      - API_PORT=8000
      - LOG_LEVEL=INFO
    volumes:
      - ./logs:/var/log/chess-analysis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - chess-analysis-api
    restart: unless-stopped
```

### 3. Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f chess-analysis-api

# Scale the service
docker-compose up -d --scale chess-analysis-api=3

# Stop services
docker-compose down
```

## 🌐 Nginx Configuration

### 1. Create nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream chess_analysis {
        server chess-analysis-api:8000;
    }

    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        limit_req zone=api burst=20 nodelay;

        # Proxy configuration
        location / {
            proxy_pass http://chess_analysis;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://chess_analysis/health;
            access_log off;
        }

        # Static files (if any)
        location /static/ {
            alias /var/www/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## ☁️ Cloud Deployment

### AWS Deployment

#### 1. EC2 Instance Setup

```bash
# Launch EC2 instance (t3.medium or larger)
# Install dependencies
sudo yum update -y
sudo yum install -y python3 python3-pip git stockfish

# Clone repository
git clone https://github.com/your-repo/chess-analytics.git
cd chess-analytics

# Install Python dependencies
pip3 install -r requirements.txt

# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_anon_key"
export STOCKFISH_PATH="/usr/bin/stockfish"

# Start the service
python3 python/core/api_server.py
```

#### 2. AWS Lambda Deployment

```python
# lambda_handler.py
import json
from core.api_server import app
from mangum import Mangum

# Create Lambda handler
handler = Mangum(app)

def lambda_handler(event, context):
    return handler(event, context)
```

#### 3. ECS/Fargate Deployment

```yaml
# task-definition.json
{
  "family": "chess-analysis",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "chess-analysis-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/chess-analysis:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "SUPABASE_URL",
          "value": "your_supabase_url"
        },
        {
          "name": "SUPABASE_ANON_KEY",
          "value": "your_anon_key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/chess-analysis",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Deployment

#### 1. Cloud Run Deployment

```yaml
# cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/chess-analysis', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/chess-analysis']
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'deploy', 'chess-analysis', '--image', 'gcr.io/$PROJECT_ID/chess-analysis', '--platform', 'managed', '--region', 'us-central1', '--allow-unauthenticated']
```

#### 2. App Engine Deployment

```yaml
# app.yaml
runtime: python39
service: chess-analysis

env_variables:
  SUPABASE_URL: "your_supabase_url"
  SUPABASE_ANON_KEY: "your_anon_key"
  STOCKFISH_PATH: "/usr/bin/stockfish"

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

handlers:
  - url: /.*
    script: auto
```

### Azure Deployment

#### 1. Azure Container Instances

```bash
# Create resource group
az group create --name chess-analysis-rg --location eastus

# Deploy container
az container create \
  --resource-group chess-analysis-rg \
  --name chess-analysis \
  --image your-registry.azurecr.io/chess-analysis:latest \
  --dns-name-label chess-analysis \
  --ports 8000 \
  --environment-variables \
    SUPABASE_URL=your_supabase_url \
    SUPABASE_ANON_KEY=your_anon_key
```

#### 2. Azure App Service

```bash
# Create App Service plan
az appservice plan create --name chess-analysis-plan --resource-group chess-analysis-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group chess-analysis-rg --plan chess-analysis-plan --name chess-analysis-app --deployment-container-image-name your-registry.azurecr.io/chess-analysis:latest

# Configure app settings
az webapp config appsettings set --resource-group chess-analysis-rg --name chess-analysis-app --settings SUPABASE_URL=your_supabase_url SUPABASE_ANON_KEY=your_anon_key
```

## 🔒 Security Configuration

### 1. Environment Security

```bash
# Use secrets management
export SUPABASE_ANON_KEY=$(aws secretsmanager get-secret-value --secret-id chess-analysis/supabase-key --query SecretString --output text)

# Or use Azure Key Vault
export SUPABASE_ANON_KEY=$(az keyvault secret show --vault-name chess-analysis-vault --name supabase-key --query value --output tsv)
```

### 2. API Security

```python
# Add to api_server.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

# Protect endpoints
@app.post("/analyze-games")
async def analyze_games(request: AnalysisRequest, token: dict = Depends(verify_token)):
    # ... existing code
```

### 3. Database Security

```sql
-- Enable RLS (Row Level Security)
ALTER TABLE game_analyses ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can access their own analyses" ON game_analyses
    FOR ALL USING (auth.uid()::text = user_id);
```

## 📊 Monitoring and Logging

### 1. Application Monitoring

```python
# Add to api_server.py
import logging
from prometheus_client import Counter, Histogram, generate_latest
from fastapi import Response

# Metrics
REQUEST_COUNT = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('api_request_duration_seconds', 'API request duration')

@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path).inc()
    REQUEST_DURATION.observe(process_time)
    
    response.headers["X-Process-Time"] = str(process_time)
    return response

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 2. Logging Configuration

```python
# Add to api_server.py
import logging
from logging.handlers import RotatingFileHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('logs/chess-analysis.log', maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Use logger throughout the application
logger.info("Starting chess analysis API server")
```

### 3. Health Checks

```python
# Enhanced health check
@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "services": {}
    }
    
    # Check database
    try:
        response = supabase.table('game_analyses').select('id').limit(1).execute()
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"
    
    # Check Stockfish
    try:
        engine = get_analysis_engine()
        if engine.stockfish_path and os.path.exists(engine.stockfish_path):
            health_status["services"]["stockfish"] = "healthy"
        else:
            health_status["services"]["stockfish"] = "unavailable"
    except Exception as e:
        health_status["services"]["stockfish"] = f"unhealthy: {str(e)}"
    
    return health_status
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy Chess Analysis API

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run tests
        run: |
          python python/core/analysis_engine.py
          python python/core/config.py

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to production
        run: |
          # Your deployment commands here
          echo "Deploying to production..."
```

## 📈 Performance Optimization

### 1. Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_game_analyses_user_platform ON game_analyses(user_id, platform);
CREATE INDEX idx_game_analyses_analysis_date ON game_analyses(analysis_date);
CREATE INDEX idx_games_user_platform ON games(user_id, platform);
```

### 2. Caching

```python
# Add Redis caching
import redis
from functools import wraps

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cache_result(ttl=3600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

# Use caching
@cache_result(ttl=1800)  # 30 minutes
async def analyze_position(request: PositionAnalysisRequest):
    # ... existing code
```

### 3. Load Balancing

```nginx
# nginx.conf - Load balancing
upstream chess_analysis {
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
}

server {
    location / {
        proxy_pass http://chess_analysis;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Stockfish not found**
   - Check `STOCKFISH_PATH` environment variable
   - Verify executable exists and is accessible
   - System will fall back to basic analysis

2. **Database connection issues**
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Check network connectivity
   - Verify database permissions

3. **Memory issues**
   - Monitor memory usage with `htop` or `top`
   - Reduce batch sizes
   - Increase server memory

4. **Performance issues**
   - Check CPU usage
   - Monitor database query performance
   - Consider caching frequently accessed data

### Monitoring Commands

```bash
# Check service status
systemctl status chess-analysis

# View logs
tail -f /var/log/chess-analysis/analysis.log

# Monitor resources
htop
iostat -x 1

# Check database connections
psql -h your-db-host -U your-user -d your-db -c "SELECT * FROM pg_stat_activity;"
```

## ✅ Deployment Checklist

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Stockfish installed and accessible
- [ ] SSL certificates configured (if using HTTPS)
- [ ] Firewall rules configured
- [ ] Monitoring and logging set up
- [ ] Health checks working
- [ ] Load testing completed
- [ ] Backup procedures in place
- [ ] Documentation updated
- [ ] Team trained on new system

This comprehensive deployment guide ensures your unified chess analysis system is production-ready and scalable!
