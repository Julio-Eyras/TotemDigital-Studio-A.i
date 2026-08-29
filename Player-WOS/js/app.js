document.addEventListener("DOMContentLoaded", async () => {
  try {
    WosLogger.info("APP", "Iniciando Player-WOS...");
    const config = await ConfigLoader.load();
    const api = new DispatcherApi(config.serverUrl, config.uin, config.deviceId, "webos");
    const eventsClient = new PlayerEventsClient(api);
    const controller = new PlayerControllerWOS(config, api, eventsClient);
    window.playerWos = { config, api, controller };
    await controller.start();
  } catch (err) {
    WosLogger.error("APP", "Falha ao iniciar Player-WOS", err);
  }
});
