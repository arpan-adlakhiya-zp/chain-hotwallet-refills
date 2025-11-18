# Testing Guide

[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](coverage)
[![Tests](https://img.shields.io/badge/tests-423%20passing-brightgreen)](tests)
[![Jest](https://img.shields.io/badge/jest-29.7.0-blue)](package.json)

Comprehensive testing guide for the Chain Hot Wallet Refill service. This document covers test structure, writing guidelines, coverage metrics, and best practices for maintaining test quality.

## Table of Contents

- [Overview](#overview)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The test suite uses **Jest** as the testing framework and maintains **81% code coverage** across all metrics. All tests are designed to run in isolation with comprehensive mocking of external dependencies, ensuring fast execution and reliable results.

**Key Principles:**
- All external dependencies (database, providers, APIs) are mocked
- Tests use singleton service instances (not `new ClassName()`)
- No real database or API calls in unit/integration tests
- E2E tests in `src/tests/` require real database and provider credentials

### Test Categories

**Unit Tests** (`src/__tests__/unit/`)
- Test individual components in complete isolation
- Mock all dependencies using `jest.mock()`
- Fast execution (< 1 second per test file)
- Examples: Service methods, utility functions, database helpers

**Integration Tests** (`src/__tests__/integration/`)
- Test API endpoints and request/response flows
- Mock service layer but test Express middleware chain
- Verify HTTP status codes and response formats
- Examples: Refill request flow, health check endpoint

**E2E Tests** (`src/tests/`)
- End-to-end tests requiring real database and provider credentials
- Run separately using `npm run test:e2e`
- Not included in standard test suite

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

### Advanced Usage

```bash
# Run specific test file
npm test -- src/__tests__/unit/service/refillService.test.js

# Run tests matching pattern
npm test -- --testNamePattern="should process valid refill"

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with verbose output
npm test -- --verbose

# Run tests in parallel (default)
npm test -- --maxWorkers=4

# Run tests sequentially (for debugging)
npm test -- --runInBand
```

### Manual Testing

Import the `testing.postman_collection.json` file in Postman to test the refill flow manually. Update the following Collection Variables to the appropriate values:
1. `baseUrl` (Example: http://localhost:3001/v1)
2. `authPrivateKey` (If `authEnabled` is set to `true`)

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/lcov-report/index.html

# Coverage thresholds (enforced)
# - Statements: 75%
# - Branches: 70%
# - Functions: 75%
# - Lines: 75%
```

## Test Coverage

### Current Metrics

The project maintains **95% code coverage** across all metrics:

- **Statements**: 95.91%
- **Branches**: 88.97%
- **Functions**: 96.89%
- **Lines**: 95.9%

### Coverage Exclusions

The following files are excluded from coverage (see `jest.config.js`):

- `src/index.js` - Application entry point
- `src/middleware/expressServer.js` - Express server setup
- `src/utils/terminate.js` - Graceful shutdown utilities
- `src/utils/slackAlerts.js` - Slack notification utilities
- `src/database/config/migration.js` - Migration configuration
- `src/database/migrations/**` - Migration files
- `src/database/models/index.js` - Model index file
- `src/middleware/logger.js` - Logging middleware

### Coverage Goals

- **Minimum Threshold**: 75% across all metrics (enforced in CI/CD)
- **Target**: 85% for new code
- **Critical Paths**: 90%+ for business logic (services, validation)

## Writing Tests

### Test File Structure

```javascript
// Mock dependencies before imports
jest.mock('../../../service/dependency');
jest.mock('../../../config');

// Import after mocks
const service = require('../../../service/myService');
const dependency = require('../../../service/dependency');

describe('MyService', () => {
  let mockData;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup test data
    mockData = { /* ... */ };
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      dependency.method.mockResolvedValue({ success: true });
      
      // Act
      const result = await service.methodName(mockData);
      
      // Assert
      expect(result.success).toBe(true);
      expect(dependency.method).toHaveBeenCalledWith(mockData);
    });

    it('should handle error case', async () => {
      // Arrange
      dependency.method.mockRejectedValue(new Error('Test error'));
      
      // Act & Assert
      await expect(service.methodName(mockData))
        .rejects.toThrow('Test error');
    });
  });
});
```

### Testing Patterns

**1. Testing Service Methods**

```javascript
describe('processRefillRequestService', () => {
  it('should process valid refill request successfully', async () => {
    // Mock validation to succeed
    refillValidationService.validateRefillRequest.mockResolvedValue({
      success: true,
      data: { provider: mockProvider, details: validatedData }
    });
    
    // Mock transaction creation
    refillTransactionService.createRefillTransaction.mockResolvedValue({
      success: true,
      data: { transaction: { id: 123 } }
    });
    
    // Execute
    const result = await refillService.processRefillRequestService(mockRefillData);
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.data.refillRequestId).toBe('REQ001');
  });
});
```

**2. Testing Error Handling**

```javascript
it('should return error when validation fails', async () => {
  refillValidationService.validateRefillRequest.mockResolvedValue({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR'
  });
  
  const result = await refillService.processRefillRequestService(mockRefillData);
  
  expect(result.success).toBe(false);
  expect(result.code).toBe('VALIDATION_ERROR');
});
```

**3. Testing Async Operations**

```javascript
it('should handle concurrent operations', async () => {
  const promises = Array.from({ length: 5 }, (_, i) =>
    service.processRequest({ id: i })
  );
  
  const results = await Promise.allSettled(promises);
  
  expect(results).toHaveLength(5);
  results.forEach(result => {
    expect(result.status).toBe('fulfilled');
  });
});
```

**4. Testing Middleware**

```javascript
describe('authenticate middleware', () => {
  it('should authenticate valid JWT token', () => {
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    mockReq.rawBody = token;
    
    authenticate(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.verifiedData).toBeDefined();
  });
});
```

### Mocking Guidelines

**1. Mock External Dependencies**

```javascript
// Mock at module level
jest.mock('../../../service/chainDb');
jest.mock('../../../providers/fireblocks');

// Access mocked module
const databaseService = require('../../../service/chainDb');
```

**2. Mock Singleton Services**

```javascript
// Services are exported as singletons
const refillService = require('../../../service/refillService');

// Reset singleton state in beforeEach
beforeEach(() => {
  refillService.initialized = false;
  jest.clearAllMocks();
});
```

**3. Mock Configuration**

```javascript
jest.mock('../../../config', () => ({
  get: jest.fn(),
  getSecret: jest.fn((key) => {
    if (key === 'chainDb') return { /* ... */ };
    return null;
  }),
  getAllConfig: jest.fn()
}));
```

## Test Utilities

### Global Helpers

Available in all tests via `src/__tests__/setup.js`:

**`createMockProvider(name)`**
```javascript
const mockProvider = createMockProvider('fireblocks');
// Returns: { init, getTokenBalance, createTransferRequest, ... }
```

**`createMockAsset(overrides)`**
```javascript
const mockAsset = createMockAsset({
  symbol: 'BTC',
  decimals: 8,
  contractAddress: 'native'
});
```

**`createMockBlockchain(overrides)`**
```javascript
const mockBlockchain = createMockBlockchain({
  name: 'Bitcoin',
  symbol: 'BTC'
});
```

**`createMockWallet(overrides)`**
```javascript
const mockWallet = createMockWallet({
  address: '0x123',
  walletType: 'hot'
});
```

### Common Assertions

```javascript
// Success responses
expect(result.success).toBe(true);
expect(result.data).toBeDefined();

// Error responses
expect(result.success).toBe(false);
expect(result.code).toBe('ERROR_CODE');
expect(result.error).toContain('Error message');

// Function calls
expect(mockFunction).toHaveBeenCalled();
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
expect(mockFunction).toHaveBeenCalledTimes(2);

// Object matching
expect(result).toEqual(expect.objectContaining({
  refillRequestId: 'REQ001',
  status: 'PROCESSING'
}));
```

## Best Practices

### 1. Test Organization

- **One test file per source file**: `refillService.js` → `refillService.test.js`
- **Group related tests**: Use nested `describe` blocks
- **Descriptive test names**: Use "should [expected behavior] when [condition]"

### 2. Test Isolation

- **Reset mocks**: Use `jest.clearAllMocks()` in `beforeEach`
- **Reset singleton state**: Reset service initialization flags
- **No shared state**: Each test should be independent

### 3. Mock Management

- **Mock at module level**: Place `jest.mock()` before imports
- **Use `jest.spyOn()` for partial mocks**: When you need to spy on existing implementations
- **Verify mock calls**: Assert that dependencies are called correctly

### 4. Coverage Strategy

- **Test happy paths**: Ensure core functionality works
- **Test error paths**: Verify error handling and edge cases
- **Test boundary conditions**: Null, undefined, empty arrays, etc.
- **Test async operations**: Promises, callbacks, timeouts

### 5. Performance

- **Fast tests**: Unit tests should run in milliseconds
- **Parallel execution**: Jest runs tests in parallel by default
- **Avoid real I/O**: Mock all database and API calls

## Troubleshooting

### Common Issues

**Issue**: `TypeError: Cannot read properties of undefined`
- **Cause**: Mock not set up before import
- **Solution**: Ensure `jest.mock()` is called before `require()`

**Issue**: Tests passing individually but failing in suite
- **Cause**: Shared state between tests
- **Solution**: Add `jest.clearAllMocks()` and reset singleton state in `beforeEach`

**Issue**: `Cannot find module` errors
- **Cause**: Incorrect relative path in mock
- **Solution**: Verify path matches actual file location

**Issue**: Mock not being called
- **Cause**: Service using cached instance
- **Solution**: Reset singleton state: `service.initialized = false`

**Issue**: Coverage not updating
- **Cause**: Files excluded in `jest.config.js`
- **Solution**: Check `collectCoverageFrom` configuration

### Debug Mode

Run tests with Node debugger:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Or use Jest's built-in debugging:

```bash
npm test -- --no-cache --verbose
```

### Test Output

For detailed test output:

```bash
# Verbose output
npm test -- --verbose

# Show coverage for untested files
npm run test:coverage -- --verbose

# Watch mode with verbose
npm run test:watch -- --verbose
```

## Additional Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Testing Best Practices**: See existing test files for examples
- **Coverage Reports**: `coverage/lcov-report/index.html` after running `npm run test:coverage`
