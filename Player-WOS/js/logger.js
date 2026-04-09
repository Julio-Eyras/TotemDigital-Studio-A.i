class WosLogger {
  static now() {
    return new Date().toISOString();
  }

  static info(category, message) {
    console.log(`${WosLogger.now()} [I] [${category}] ${message}`);
  }

  static warn(category, message) {
    console.warn(`${WosLogger.now()} [W] [${category}] ${message}`);
  }

  static error(category, message, err) {
    console.error(`${WosLogger.now()} [E] [${category}] ${message}`, err || "");
  }
}

window.WosLogger = WosLogger;
