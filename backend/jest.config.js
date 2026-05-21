export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^../fabric/gateway\.js$':    '<rootDir>/tests/mocks/gateway.js',
    '^../../fabric/gateway\.js$': '<rootDir>/tests/mocks/gateway.js',
    '^../services/email\.js$':    '<rootDir>/tests/mocks/email.js',
    '^../../services/email\.js$': '<rootDir>/tests/mocks/email.js',
  },
  testMatch: ['**/tests/unit/**/*.test.js','**/tests/integration/**/*.test.js','**/tests/regression/**/*.test.js'],
  coverageThreshold: { global: { branches:60, functions:70, lines:70, statements:70 } },
  testTimeout: 30000,
  verbose: true,
};