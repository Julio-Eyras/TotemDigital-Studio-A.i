/**
 * Jest Configuration - Smart Signage v2.1
 *
 * Dois projetos: unit (paralelo) e integration (serial, timeout 30s).
 */

module.exports = {
  verbose: true,
  forceExit: true,
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
      testTimeout: 10000,
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      collectCoverageFrom: [
        'src/validators/**/*.ts',
        'src/utils/apiResponse.ts',
        'src/utils/dbErrors.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
      ],
      coverageDirectory: 'coverage',
      coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
      coverageThreshold: {
        global: {
          branches: 60,
          functions: 60,
          lines: 70,
          statements: 70,
        },
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      setupFilesAfterEnv: [
        '<rootDir>/src/__tests__/setup.ts',
        '<rootDir>/src/__tests__/setup.integration.ts',
      ],
      testTimeout: 30000,
      maxWorkers: 1,
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
    },
  ],
};
