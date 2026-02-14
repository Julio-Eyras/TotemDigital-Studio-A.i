// Script de build que desabilita o ESLint
// Usa resolução explícita do path para evitar "Cannot find module 'react-scripts/scripts/build'"
process.env.DISABLE_ESLINT_PLUGIN = 'true';
const path = require('path');
const reactScriptsDir = path.dirname(require.resolve('react-scripts/package.json'));
require(path.join(reactScriptsDir, 'scripts', 'build.js'));

