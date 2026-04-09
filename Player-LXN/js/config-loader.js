class ConfigLoader {
  static defaults() {
    return {
      serverUrl: "http://192.168.1.110",
      uin: "tot001",
      deviceId: "linux-player-tot001",
      acceptImagesInPlaylist: true,
      fallbackPropagandasPerVinheta: 3,
      imageDurationSeconds: 20,
      fallbackPropagandas: ["assets/propagandas/propaganda-001.mp4"],
      fallbackVinhetas: ["assets/vinhetas/vinheta-001.mp4"]
    };
  }

  static async load() {
    try {
      const res = await fetch("config/player-config.json", { cache: "no-store" });
      if (res.ok) return { ...ConfigLoader.defaults(), ...(await res.json()) };
    } catch (_) {}
    return ConfigLoader.defaults();
  }
}
window.ConfigLoader = ConfigLoader;
