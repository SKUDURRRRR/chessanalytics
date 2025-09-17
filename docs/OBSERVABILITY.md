# Observability Documentation

## Overview
This document outlines the observability strategy for the Chess Analytics platform, including logging, monitoring, and alerting.

## Logging Strategy

### Log Levels
- **ERROR**: System errors, exceptions, failures
- **WARN**: Warning conditions, degraded performance
- **INFO**: General information, user actions
- **DEBUG**: Detailed debugging information

### Log Sources

#### Frontend Logging
**Location**: Browser console and error boundaries

**Key Events**:
- Component errors and crashes
- API call failures
- User action tracking
- Performance metrics

**Example**:
```javascript
console.error('Error starting analysis:', error)
console.log('User selected player:', userId, platform)
console.warn('API not available, falling back to cached data')
```

#### Backend Logging
**Location**: Python FastAPI application logs

**Key Events**:
- API request/response logging
- Database operation results
- Analysis progress tracking
- Error handling and recovery

**Example**:
```python
console.log(f'Starting analysis for {user_id} on {platform}')
console.error(f'Analysis failed for {user_id}: {error}')
console.log(f'Analysis progress: {progress_percentage}%')
```

#### Database Logging
**Location**: Supabase logs and query logs

**Key Events**:
- Query performance
- Connection issues
- RLS policy violations
- Data integrity errors

### Log Format
**Standard Format**: `[TIMESTAMP] [LEVEL] [COMPONENT] MESSAGE`

**Example**:
```
2025-09-17T21:00:00Z [INFO] [PlayerSearch] User searched for player: magnus
2025-09-17T21:00:01Z [ERROR] [AutoImport] Failed to fetch games: HTTP 404
2025-09-17T21:00:02Z [DEBUG] [AnalysisService] Analysis progress: 45%
```

## Metrics

### Application Metrics

#### Performance Metrics
- **API Response Time**: Average response time per endpoint
- **Database Query Time**: Query execution time
- **Analysis Processing Time**: Time to analyze games
- **Import Processing Time**: Time to import user games

#### Business Metrics
- **Active Users**: Number of users using the platform
- **Games Analyzed**: Total games processed
- **Analysis Success Rate**: Percentage of successful analyses
- **Import Success Rate**: Percentage of successful imports

#### System Metrics
- **Memory Usage**: Application memory consumption
- **CPU Usage**: CPU utilization
- **Database Connections**: Active connection count
- **Error Rate**: Error frequency per component

### Custom Metrics

#### Chess-Specific Metrics
- **Personality Score Distribution**: Distribution of personality scores
- **Opening Popularity**: Most played openings
- **Time Control Distribution**: Popular time controls
- **Rating Distribution**: Player rating ranges

#### User Behavior Metrics
- **Search Patterns**: Common search queries
- **Feature Usage**: Most used features
- **Session Duration**: Average session length
- **Return Users**: User retention metrics

## Monitoring

### Health Checks

#### API Health Check
**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "service": "chess-analysis-api",
  "timestamp": "2025-09-17T21:00:00Z"
}
```

#### Database Health Check
**Query**: `supabase/sql/health.sql`

**Checks**:
- Database connectivity
- Table accessibility
- RLS policy functionality
- Performance metrics

#### Frontend Health Check
**Component**: ErrorBoundary

**Checks**:
- Component rendering
- API connectivity
- State management
- User interaction

### Performance Monitoring

#### API Performance
- **Response Time**: Tracked per endpoint
- **Throughput**: Requests per second
- **Error Rate**: Failed requests percentage
- **Availability**: Uptime percentage

#### Database Performance
- **Query Performance**: Slow query identification
- **Connection Pool**: Connection utilization
- **Index Usage**: Index effectiveness
- **Lock Contention**: Database locking issues

#### Frontend Performance
- **Page Load Time**: Initial page load
- **Component Render Time**: React component performance
- **Bundle Size**: JavaScript bundle size
- **Memory Usage**: Browser memory consumption

## Alerting

### Alert Categories

#### Critical Alerts
- **System Down**: Service unavailable
- **Database Down**: Database connectivity lost
- **High Error Rate**: Error rate > 5%
- **Memory Leak**: Memory usage > 90%

#### Warning Alerts
- **High Response Time**: Response time > 2s
- **Low Success Rate**: Success rate < 95%
- **Resource Usage**: CPU/Memory > 80%
- **Queue Backlog**: Analysis queue > 100 items

#### Info Alerts
- **New User**: New user registration
- **Analysis Complete**: Large analysis finished
- **Deployment**: New deployment successful
- **Maintenance**: Scheduled maintenance

### Alert Channels
- **Email**: Critical alerts to admin team
- **Slack**: Warning alerts to development team
- **PagerDuty**: Critical alerts for on-call rotation
- **Dashboard**: Real-time monitoring dashboard

## Dashboards

### System Dashboard
**Purpose**: Overall system health and performance

**Metrics**:
- System uptime
- API response times
- Database performance
- Error rates
- Resource utilization

### Business Dashboard
**Purpose**: Business metrics and user activity

**Metrics**:
- Active users
- Games analyzed
- Analysis success rate
- Popular features
- User retention

### Chess Analytics Dashboard
**Purpose**: Chess-specific metrics and insights

**Metrics**:
- Personality score distributions
- Opening popularity
- Time control preferences
- Rating distributions
- Analysis accuracy

## Tracing

### Request Tracing
**Purpose**: Track requests across system components

**Trace Points**:
- Frontend API calls
- Backend request processing
- Database queries
- External API calls
- Analysis processing

### User Journey Tracing
**Purpose**: Track user interactions and workflows

**Trace Points**:
- User search actions
- Game import process
- Analysis initiation
- Results viewing
- Error recovery

## 2025-09-17 — Signal Changes

### New Logging Implementations
- **Error Boundary Logging**: React component error capture
- **API Error Logging**: Comprehensive API error tracking
- **Database Operation Logging**: Query performance and error tracking
- **User Action Logging**: User interaction tracking

### New Metrics Added
- **Analysis Progress Tracking**: Real-time analysis progress
- **Import Success Metrics**: Game import success rates
- **Personality Score Metrics**: Score distribution tracking
- **User Engagement Metrics**: Feature usage tracking

### New Monitoring Capabilities
- **Health Check Endpoints**: System health verification
- **Progress Tracking**: Long-running operation monitoring
- **Error Rate Monitoring**: Error frequency tracking
- **Performance Monitoring**: Response time tracking

### New Alerting Rules
- **Analysis Failure Alerts**: Failed analysis notifications
- **Import Error Alerts**: Import failure notifications
- **API Health Alerts**: Service availability notifications
- **Performance Alerts**: Response time threshold alerts

## Log Retention

### Retention Policy
- **Error Logs**: 90 days
- **Info Logs**: 30 days
- **Debug Logs**: 7 days
- **Audit Logs**: 1 year

### Storage
- **Local Development**: Console output
- **Staging**: File-based logging
- **Production**: Centralized logging service

## Security Considerations

### Log Sanitization
- **PII Removal**: Remove personally identifiable information
- **Sensitive Data**: Mask API keys and passwords
- **Error Details**: Sanitize error messages
- **User Data**: Anonymize user-specific data

### Access Control
- **Log Access**: Role-based access to logs
- **Audit Trail**: Track log access
- **Encryption**: Encrypt sensitive logs
- **Retention**: Secure log disposal

## Performance Impact

### Logging Overhead
- **Minimal Impact**: Async logging where possible
- **Selective Logging**: Log only necessary information
- **Performance Monitoring**: Track logging impact
- **Optimization**: Regular performance review

### Monitoring Overhead
- **Lightweight Metrics**: Minimal performance impact
- **Sampling**: Sample high-volume metrics
- **Caching**: Cache frequently accessed metrics
- **Optimization**: Regular performance tuning

