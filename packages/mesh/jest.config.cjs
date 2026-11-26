/** Jest runs the TypeScript sources through ts-jest. @meshtastic/protobufs is
 * ESM-only, so it is transformed to CommonJS as well. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@meshtastic/protobufs/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**'],
};
