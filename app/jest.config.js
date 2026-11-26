const { transformIgnorePatterns } = require('jest-expo/jest-preset');

/**
 * Packages shipped as ES modules that Jest must transform. @huntclub/mesh
 * depends on them (it is TypeScript source and is transformed already).
 */
const ESM_PACKAGES = ['@meshtastic', '@bufbuild'];

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  // Extend the preset's allow-list of node_modules to transform.
  transformIgnorePatterns: transformIgnorePatterns.map((pattern, i) =>
    i === 0 ? pattern.replace('(?!(', `(?!(${ESM_PACKAGES.join('|')}|`) : pattern,
  ),
};
