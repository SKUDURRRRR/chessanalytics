# Chess Analytics Documentation Index

## Overview
Documentation for the Chess Analytics platform - a system for analyzing chess games with Stockfish, personality profiling, and AI coaching.

## Quick Start
- [Developer Quick Start](./DEVELOPER_QUICK_START.md) - Setup and development workflow
- [API Documentation](./API_DOCUMENTATION.md) - REST API endpoints and schemas
- [Database Schema](./DATABASE_SCHEMA_FINAL.md) - Complete database structure

## Reference Documentation

### Architecture
- [Technical Summary](./TECHNICAL_SUMMARY.md) - Architecture breakdown, data flow, API endpoints
- [System Map](./system_map.md) - System architecture overview
- [Error Flow Diagram](./ERROR_FLOW_DIAGRAM.md) - Error handling architecture
- [Game Import Flow](./game-import-flow.md) - Data import pipeline
- [Analysis Types](./ANALYSIS_TYPES_CLARIFICATION.md) - Stockfish vs deep analysis

### API
- [API Documentation](./API_DOCUMENTATION.md) - Endpoint reference
- [API Reference](./API.md) - API schemas and examples
- [API Migration Guide](./API_MIGRATION_GUIDE.md) - Legacy to unified API migration

### Database
- [Database Schema](./DATABASE_SCHEMA_FINAL.md) - Tables, indexes, constraints
- [Database Details](./DB/) - Data dictionary and schema details

### Chess Analysis
- [Move Classification Standards](./MOVE_CLASSIFICATION_STANDARDS.md) - chess.com-standard move classifications
- [Move Evaluation Standards](./MOVE_EVALUATION_STANDARDS.md) - Centipawn evaluation reference
- [Personality Model](./PERSONALITY_MODEL.md) - 6-trait personality scoring system
- [Personality Traits Quick Reference](./PERSONALITY_TRAITS_QUICKREF.md) - Trait descriptions
- [Stockfish Integration](./STOCKFISH_INTEGRATION.md) - Engine setup and configuration

### UI/Frontend
- [UI Color System](./UI_COLOR_SYSTEM.md) - Color coding for chess analysis terms
- [Color Quick Reference](./COLOR_QUICK_REFERENCE.md) - Developer quick reference for colors

### Setup & Configuration
- [AI Comment Setup](./AI_COMMENT_SETUP.md) - AI coaching comment configuration
- [Chess.com OAuth Setup](./CHESS_COM_OAUTH_SETUP.md) - Chess.com integration
- [Stripe Setup](./STRIPE_SETUP.md) - Payment integration
- [Stripe Testing Guide](./STRIPE_TESTING_GUIDE.md) - Payment testing
- [Supabase Setup](./setup-supabase.md) - Database setup

### Development
- [Development Workflow](./DEVELOPMENT_WORKFLOW.md) - Development process
- [Safe Development Workflow](./SAFE_DEVELOPMENT_WORKFLOW.md) - Safety guidelines
- [Quality Standards](./QUALITY_STANDARDS.md) - Code quality standards
- [Security Policy](./SECURITY_POLICY.md) - Security guidelines

### Testing
- [Local Testing Guide](./LOCAL_TESTING_GUIDE.md) - Local test setup
- [Mobile Testing Guide](./mobile-testing-guide.md) - Mobile testing
- [Mobile QA Checklist](./MOBILE_QA_CHECKLIST.md) - Mobile QA reference
- [Test Plan](./QUALITY/TEST_PLAN.md) - Comprehensive test plan

### Calibration
- [Personality Calibration](./personality_calibration/) - Personality scoring calibration data

## Archive
Historical fix reports, implementation summaries, and deployment logs are in [docs/archive/](./archive/):
- `archive/bug-reports/` - Historical bug fixes
- `archive/feature-analysis/` - Feature implementation records
- `archive/performance/` - Performance optimization history
- `archive/security/` - Security audit records
- `archive/deployment/` - Deployment logs and checklists
