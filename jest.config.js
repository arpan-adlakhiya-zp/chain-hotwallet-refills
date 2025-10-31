module.exports = {
  testEnvironment: 'node',
  
  // Coverage settings
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/**/__tests__/**',
    '!src/database/migrations/**',
    '!src/database/models/index.js',
    '!src/middleware/logger.js', // Logger has console.log by design
    '!index.js' // Entry point - tested via E2E
  ],
  
  // Coverage thresholds (start with achievable goals, increase over time)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/tests/', // E2E tests run separately
  ],
  
  // Setup file
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  
  // Test timeout (increased for integration tests)
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true
};

