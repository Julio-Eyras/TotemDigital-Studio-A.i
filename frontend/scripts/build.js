// Script de build que desabilita o ESLint
// SOLUÇÃO DEFINITIVA: O fork-ts-checker-webpack-plugin é corrigido automaticamente
// via script postinstall (fix-fork-ts-checker.js) após npm install
process.env.DISABLE_ESLINT_PLUGIN = 'true';
require('react-scripts/scripts/build');

