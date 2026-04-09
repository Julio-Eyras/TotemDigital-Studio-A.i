class ConfigLoader {
  static defaults() {
    return {
      serverUrl: "http://192.168.1.110",
      uin: "tot001",
      deviceId: "webos-tv-tot001",
      acceptImagesInPlaylist: true,
      fallbackPropagandasPerVinheta: 3,
      imageDurationSeconds: 20,
      heartbeatIntervalMs: 30000,
      fallbackPropagandas: [],
      fallbackVinhetas: []
    };
  }

  static async load() {
    const local = localStorage.getItem("player-config.json");
    if (local) {
      try {
        return { ...ConfigLoader.defaults(), ...JSON.parse(local) };
      } catch (_) {}
    }

    try {
      const response = await fetch("config/player-config.json", { cache: "no-store" });
      if (response.ok) {
        const json = await response.json();
        return { ...ConfigLoader.defaults(), ...json };
      }
    } catch (_) {}

    return ConfigLoader.defaults();
  }
}

window.ConfigLoader = ConfigLoader;
