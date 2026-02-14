const path = require('path');

module.exports = function override(config, env) {
  // Desabilitar ESLint completamente
  config.plugins = config.plugins.filter(
    plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
  );

  // Alias para módulo compartilhado holograph-adapter
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['@shared/holograph-adapter'] = path.resolve(__dirname, '../shared/holograph-adapter');

  return config;
};

