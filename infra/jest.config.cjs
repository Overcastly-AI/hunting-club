/** Jest runs the TypeScript sources (stacks, config, Lambda handlers) through ts-jest. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }] },
  // Synthesizing bundles each Lambda with esbuild.
  testTimeout: 120000,
};
