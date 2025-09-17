# Test Plan

## Overview
This document outlines the testing strategy for the Chess Analytics platform, covering unit tests, integration tests, and end-to-end tests.

## Test Framework
- **Frontend**: Vitest with React Testing Library
- **Backend**: Python unittest/pytest
- **E2E**: Playwright
- **API**: Vitest with fetch mocking

## Test Categories

### 1. Health Check Tests
**File**: `tests/health-check.test.ts`

**Purpose**: Verify system health and connectivity

**Test Cases**:
- Database connection health
- API endpoint availability
- Supabase client connectivity
- Environment variable validation

**Coverage Target**: 100%

### 2. Contract Tests
**File**: `tests/contract.analytics.test.ts`

**Purpose**: Verify API contract compliance

**Test Cases**:
- API endpoint response formats
- Request/response schema validation
- Error response consistency
- Data type validation

**Coverage Target**: 95%

### 3. Frontend Schema Tests
**File**: `tests/fe.analytics.schema.test.ts`

**Purpose**: Validate frontend data schemas

**Test Cases**:
- TypeScript interface compliance
- Zod schema validation
- Component prop validation
- State management schemas

**Coverage Target**: 90%

### 4. Import Tests
**File**: `tests/import.idempotent.test.ts`

**Purpose**: Verify data import consistency

**Test Cases**:
- Idempotent import operations
- Duplicate data handling
- Data integrity after import
- Error recovery mechanisms

**Coverage Target**: 85%

### 5. Import Structure Tests
**File**: `tests/import.structure.test.ts`

**Purpose**: Validate import data structure

**Test Cases**:
- PGN parsing accuracy
- Data transformation correctness
- Schema compliance
- Data validation rules

**Coverage Target**: 90%

### 6. Parity Tests
**File**: `tests/parity.contract.test.ts`

**Purpose**: Ensure data consistency across systems

**Test Cases**:
- Frontend-backend data parity
- Database-API consistency
- Cross-platform data alignment
- Version compatibility

**Coverage Target**: 80%

### 7. Parity Logs Tests
**File**: `tests/parity.logs.test.ts`

**Purpose**: Verify logging consistency

**Test Cases**:
- Log format consistency
- Error logging completeness
- Performance logging accuracy
- Audit trail integrity

**Coverage Target**: 75%

### 8. RLS Admin Tests
**File**: `tests/rls.admin.test.ts`

**Purpose**: Verify Row Level Security policies

**Test Cases**:
- User data isolation
- Admin access controls
- Policy enforcement
- Security boundary testing

**Coverage Target**: 95%

### 9. Smoke Tests
**File**: `tests/smoke.prod.spec.ts`

**Purpose**: End-to-end production readiness

**Test Cases**:
- Complete user workflows
- Critical path testing
- Performance benchmarks
- Error handling scenarios

**Coverage Target**: 70%

## Test Scripts

### NPM Scripts
```json
{
  "test": "vitest run tests/health-check.test.ts",
  "test:contract": "vitest run tests/contract.analytics.test.ts",
  "test:fe": "vitest run tests/fe.analytics.schema.test.ts",
  "test:import": "vitest run tests/import.idempotent.test.ts",
  "test:import-structure": "vitest run tests/import.structure.test.ts",
  "test:health": "vitest run tests/health-check.test.ts",
  "test:parity": "vitest run tests/parity.contract.test.ts",
  "test:parity-logs": "vitest run tests/parity.logs.test.ts",
  "test:rls": "vitest run tests/rls.admin.test.ts",
  "test:smoke": "playwright test tests/smoke.prod.spec.ts",
  "test:smoke:headed": "playwright test tests/smoke.prod.spec.ts --headed"
}
```

### Utility Scripts
- `check-parity`: `tsx scripts/check-parity.ts`
- `health-check`: `node tools/run-sql.mjs`
- `ci:health`: `node tools/run-sql.mjs supabase/sql/health.sql`

## Test Data

### Sample Data
- **Games**: 8 sample games for 'testuser' on Lichess
- **Users**: Test profiles for different platforms
- **Analyses**: Sample personality analysis results
- **Features**: Sample game feature extractions

### Test Fixtures
- PGN game data
- API response mocks
- Database seed data
- User profile templates

## Coverage Targets

### Overall Coverage
- **Minimum**: 80%
- **Target**: 90%
- **Stretch**: 95%

### Component Coverage
- **Critical Paths**: 95%
- **Business Logic**: 90%
- **UI Components**: 85%
- **Utilities**: 80%

### 2025-09-17 — Test Coverage Deltas

#### New Test Suites Added
- **Health Check Tests**: System connectivity validation
- **Contract Tests**: API compliance verification
- **Frontend Schema Tests**: Type safety validation
- **Import Tests**: Data consistency verification
- **Parity Tests**: Cross-system data alignment
- **RLS Tests**: Security policy validation
- **Smoke Tests**: End-to-end workflow validation

#### Test Infrastructure
- **Vitest Configuration**: Modern testing framework setup
- **Playwright Integration**: E2E testing capabilities
- **Mock Services**: API and database mocking
- **Test Utilities**: Reusable test helpers and fixtures

#### Coverage Improvements
- **API Endpoints**: 100% endpoint coverage
- **Database Operations**: 95% CRUD operation coverage
- **Error Handling**: 90% error scenario coverage
- **User Workflows**: 85% critical path coverage

## Test Execution

### Local Development
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:contract

# Run with coverage
npm run test -- --coverage

# Run E2E tests
npm run test:smoke
```

### CI/CD Pipeline
```bash
# Health check
npm run ci:health

# Full test suite
npm run test && npm run test:contract && npm run test:fe

# E2E tests
npm run test:smoke
```

### Test Reports
- **Coverage Reports**: HTML coverage reports generated
- **Test Results**: JUnit XML format for CI integration
- **Performance Metrics**: Test execution time tracking
- **Error Reports**: Detailed failure analysis

## Quality Gates

### Pre-commit
- Linting passes
- Type checking passes
- Unit tests pass
- Coverage threshold met

### Pre-deployment
- All test suites pass
- Coverage target achieved
- Performance benchmarks met
- Security scans clean

### Post-deployment
- Smoke tests pass
- Health checks green
- Monitoring alerts configured
- Rollback plan ready

## Test Maintenance

### Regular Updates
- Test data refresh
- Dependency updates
- Coverage analysis
- Performance optimization

### Test Review
- Monthly test effectiveness review
- Quarterly coverage analysis
- Annual test strategy update
- Continuous improvement process

