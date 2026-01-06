const path = require('path');

module.exports = function override(config, env) {
  // Desabilitar ESLint completamente
  config.plugins = config.plugins.filter(
    plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
  );
  
  return config;
};

