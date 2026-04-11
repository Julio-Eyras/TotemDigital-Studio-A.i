class LxnLogger {
  static now() { return new Date().toISOString(); }
  static info(category, message) { console.log(`${LxnLogger.now()} [I] [${category}] ${message}`); }
  static warn(category, message) { console.warn(`${LxnLogger.now()} [W] [${category}] ${message}`); }
  static error(category, message, err) { console.error(`${LxnLogger.now()} [E] [${category}] ${message}`, err || ""); }
}
window.LxnLogger = LxnLogger;
