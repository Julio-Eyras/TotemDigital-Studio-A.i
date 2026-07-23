/**
 * Versão do frontend (build). Preferir REACT_APP_VERSION se definida no build;
 * caso contrário usa package.json.
 */
import packageJson from '../../package.json';

export const FRONT_VERSION =
  process.env.REACT_APP_VERSION || packageJson.version || '2.1.3';
