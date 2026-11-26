/** Node-only checks of the design package's dev scripts (the tokens themselves are platform-neutral). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.scripts.json' }],
  },
};
