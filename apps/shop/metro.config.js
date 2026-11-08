// Expo's default Metro config understands pnpm workspaces (packages/core, packages/mobile-ui).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
