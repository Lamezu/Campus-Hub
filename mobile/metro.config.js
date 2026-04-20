const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const workspaceRoot = path.resolve(__dirname, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

config.watchFolders = [sharedRoot];

config.resolver.extraNodeModules = {
    firebase: path.resolve(__dirname, 'node_modules/firebase'),
    'firebase/firestore': path.resolve(__dirname, 'node_modules/firebase/firestore'),
    'firebase/auth': path.resolve(__dirname, 'node_modules/firebase/auth'),
    'firebase/app': path.resolve(__dirname, 'node_modules/firebase/app'),
    '@': path.resolve(__dirname),
};

config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
