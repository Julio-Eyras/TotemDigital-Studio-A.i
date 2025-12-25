// Script de build que desabilita o ESLint
// SOLUÇÃO DEFINITIVA: O fork-ts-checker-webpack-plugin será corrigido via override no package.json
// O override força schema-utils@2.7.1 que é compatível com o plugin
process.env.DISABLE_ESLINT_PLUGIN = 'true';
require('react-scripts/scripts/build');

