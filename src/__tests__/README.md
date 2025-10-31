# Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── unit/           # Isolated component tests (12 files)
└── integration/    # API endpoint tests (2 files)
```

## Writing Tests

### Unit Test Example
```javascript
const myService = require('../../../service/myService');

jest.mock('../../../service/dependency');

describe('MyService', () => {
  it('should do something', async () => {
    // Arrange
    dependency.method.mockResolvedValue('data');
    
    // Act
    const result = await myService.doSomething();
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Global Helpers

Available in all tests:
- `createMockProvider(name)` - Mock provider instance
- `createMockAsset(overrides)` - Mock asset object
- `createMockBlockchain(overrides)` - Mock blockchain object
- `createMockWallet(overrides)` - Mock wallet object

## Coverage

**Current:** 241/241 tests passing (100%)

**Targets:**
- Statements: 75%
- Branches: 70%
- Functions: 75%
- Lines: 75%

## Notes

- All external dependencies are mocked
- Tests use singletons (not `new ClassName()`)
- No real database or API calls in tests
- E2E tests in `src/tests/` require real DB & credentials
