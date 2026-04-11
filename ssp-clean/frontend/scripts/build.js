// Script de build que desabilita o ESLint e aplica config-overrides (alias @shared/holograph-adapter)
process.env.DISABLE_ESLINT_PLUGIN = 'true';
// Usar react-app-rewired para que config-overrides.js seja aplicado (resolve @shared/holograph-adapter)
require('react-app-rewired/scripts/build');

