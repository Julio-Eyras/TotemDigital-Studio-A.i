const path = require('path');

// Adapter dentro de src/ para CRA não bloquear (ModuleScopePlugin só permite src/)
const holographAdapterPath = path.resolve(__dirname, 'src', 'lib', 'holograph-adapter');

module.exports = function override(config, env) {
  // Desabilitar ESLint e ForkTsChecker (evita conflitos de ajv/ajv-keywords no build)
  const pluginBlacklist = new Set(['ESLintWebpackPlugin', 'ForkTsCheckerWebpackPlugin']);
  config.plugins = (config.plugins || []).filter(plugin => {
    const name = plugin && plugin.constructor && plugin.constructor.name;
    return !pluginBlacklist.has(name);
  });

  // Alias: @shared/holograph-adapter -> src/lib/holograph-adapter (dentro de src/)
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['@shared/holograph-adapter'] = holographAdapterPath;

  return config;
};

