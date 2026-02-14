const path = require('path');

// Adapter dentro de src/ para CRA não bloquear (ModuleScopePlugin só permite src/)
const holographAdapterPath = path.resolve(__dirname, 'src', 'lib', 'holograph-adapter');

module.exports = function override(config, env) {
  // Desabilitar ESLint completamente
  config.plugins = config.plugins.filter(
    plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
  );

  // Alias: @shared/holograph-adapter -> src/lib/holograph-adapter (dentro de src/)
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['@shared/holograph-adapter'] = holographAdapterPath;

  return config;
};

