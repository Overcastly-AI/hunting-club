/** Tests against DynamoDB Local (DYNAMODB_ENDPOINT, default http://localhost:8000). */
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['**/__tests__/**/*.db.test.ts'],
  testPathIgnorePatterns: [],
  testTimeout: 30_000,
};
