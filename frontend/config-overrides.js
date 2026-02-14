const path = require('path');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const paths = require('react-scripts/config/paths');

const sharedAdapterPath = path.resolve(__dirname, '../shared/holograph-adapter');

module.exports = function override(config, env) {
  // Desabilitar ESLint completamente
  config.plugins = config.plugins.filter(
    plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
  );

  // Alias para módulo compartilhado holograph-adapter
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['@shared/holograph-adapter'] = sharedAdapterPath;

  // Permitir imports de shared/holograph-adapter (fora de src/): ModuleScopePlugin aceita array como appSrc
  config.resolve.plugins = config.resolve.plugins || [];
  const idx = config.resolve.plugins.findIndex((p) => p && p.constructor && p.constructor.name === 'ModuleScopePlugin');
  if (idx !== -1) {
    config.resolve.plugins[idx] = new ModuleScopePlugin(
      [paths.appSrc, sharedAdapterPath],
      [paths.appPackageJson]
    );
  }

  return config;
};

