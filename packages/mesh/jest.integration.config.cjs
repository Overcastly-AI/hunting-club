/**
 * Integration tests against real meshtasticd nodes (CI workflow "mesh-sim").
 * Same transform setup as the unit tests; only the test location and
 * timeouts differ. Set MESH_SIM_NODES (see src/__integration__/sim.ts).
 */
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['**/__integration__/**/*.test.ts'],
  testTimeout: 180_000,
  verbose: true,
};
