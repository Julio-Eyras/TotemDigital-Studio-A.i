document.addEventListener("DOMContentLoaded", async () => {
  try {
    const config = await ConfigLoader.load();
    const api = new DispatcherApi(config.serverUrl, config.uin, config.deviceId);
    const events = new PlayerEventsClient(api);
    const controller = new PlayerControllerLXN(config, api, events);
    window.playerLxn = { config, api, controller };
    await controller.start();
  } catch (err) {
    LxnLogger.error("APP", "Falha ao iniciar Player-LXN", err);
  }
});
