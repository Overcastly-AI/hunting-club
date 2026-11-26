const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/** zod's every-locale index (ESM or CommonJS build), and its English-only stand-in. */
const ZOD_LOCALES_INDEX = /[\\/]zod[\\/]v4[\\/]locales[\\/]index\.c?js$/;
const ZOD_LOCALES_ENGLISH = path.join(__dirname, 'metro', 'zodLocalesEnglish.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = context.resolveRequest(context, moduleName, platform);
  return resolved.type === 'sourceFile' && ZOD_LOCALES_INDEX.test(resolved.filePath)
    ? { type: 'sourceFile', filePath: ZOD_LOCALES_ENGLISH }
    : resolved;
};

module.exports = config;
