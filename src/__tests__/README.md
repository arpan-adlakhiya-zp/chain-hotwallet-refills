# Testing Guide - Chain Hotwallet Refills

## Test Structure

```
src/__tests__/
├── setup.js                          # Global test setup and mocks
├── unit/                             # Unit tests (isolated components)
│   ├── config/
│   │   └── validate.test.js         # ✅ Config validator tests
│   ├── service/
│   │   ├── refillValidationService.test.js  # ✅ Validation logic
│   │   ├── refillTransactionService.test.js # ✅ Transaction management
│   │   └── utils/
│   │       └── refillUtils.test.js  # ✅ Service utilities
│   └── utils/
│       └── utils.test.js            # ✅ Generic utilities
└── integration/                      # Integration tests
    └── healthCheck.test.js          # ✅ Health check endpoint
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests (Manual)
```bash
npm run test:e2e
```

## Coverage Goals

- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 75%
- **Statements**: 75%

## Writing New Tests

### 1. Unit Tests

Test individual functions in isolation with mocked dependencies.

**Example:**
```javascript
const MyService = require('../../../service/myService');
const dependency = require('../../../service/dependency');

jest.mock('../../../service/dependency');

describe('MyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    dependency.someMethod.mockResolvedValue('mocked value');
    
    const result = await MyService.doSomething();
    
    expect(result).toBe('expected');
    expect(dependency.someMethod).toHaveBeenCalled();
  });
});
```

### 2. Integration Tests

Test multiple components working together.

**Example:**
```javascript
const request = require('supertest');
const express = require('express');
const { router } = require('../../routes/routes');

describe('API Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  it('should process request end-to-end', async () => {
    const response = await request(app)
      .post('/v1/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success');
  });
});
```

## Global Test Utilities

The `setup.js` file provides global helper functions:

### createMockProvider(providerName)
Creates a mock provider instance with all required methods.

```javascript
const mockProvider = createMockProvider('fireblocks');
mockProvider.getTokenBalance.mockResolvedValue('1000000');
```

### createMockAsset(overrides)
Creates a mock asset object with sensible defaults.

```javascript
const asset = createMockAsset({ symbol: 'ETH', decimals: 18 });
```

### createMockBlockchain(overrides)
Creates a mock blockchain object.

```javascript
const blockchain = createMockBlockchain({ name: 'Ethereum', symbol: 'ETH' });
```

### createMockWallet(overrides)
Creates a mock wallet object.

```javascript
const wallet = createMockWallet({ walletType: 'hot', address: '0x123' });
```

## Best Practices

1. **Mock External Dependencies**: Always mock database, providers, and external APIs
2. **Test Edge Cases**: Null, undefined, empty values, very large numbers
3. **Test Error Paths**: What happens when things fail?
4. **Clear Mocks**: Use `jest.clearAllMocks()` in `beforeEach()`
5. **Descriptive Names**: Test names should describe expected behavior
6. **One Assertion Per Test**: Keep tests focused and simple
7. **Arrange-Act-Assert**: Structure tests clearly

## Next Steps

### Priority Tests to Add:

1. **Database Helpers** (`src/__tests__/unit/database/helpers/`)
   - asset.test.js
   - blockchain.test.js
   - wallet.test.js
   - refillTransaction.test.js

2. **Service Layer** (`src/__tests__/unit/service/`)
   - refillService.test.js
   - chainDb.test.js

3. **Provider Layer** (`src/__tests__/unit/providers/`)
   - fireblocks/walletFactory.test.js
   - fireblocks/transaction.test.js
   - fireblocks/index.test.js

4. **Integration Tests** (`src/__tests__/integration/`)
   - refillFlow.test.js (complete refill request flow)

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests timing out?
Increase timeout in `jest.config.js`:
```javascript
testTimeout: 15000
```

### Mocks not working?
Ensure mocks are cleared between tests:
```javascript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Import errors?
Check that module paths are correct relative to test file location.

