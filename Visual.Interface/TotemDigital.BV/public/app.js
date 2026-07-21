const state = {
  contents: [],
  currentIndex: 0,
  rotationTimer: null,
  refreshTimer: null,
  config: {
    defaultRotationSeconds: 10,
    contentRefreshSeconds: 30
  }
};

const stage = document.querySelector("#content-stage");
const counter = document.querySelector("#content-counter");
const lastUpdate = document.querySelector("#last-update");
const connectionStatus = document.querySelector("#connection-status");
const connectionDot = document.querySelector("#connection-dot");

function setConnectionStatus(online) {
  connectionStatus.textContent = online ? "Online" : "Offline";
  connectionDot.classList.toggle("online", online);
  connectionDot.classList.toggle("offline", !online);
}

async function loadConfig() {
  const response = await fetch("/api/config", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Falha ao carregar configuraÃ§Ã£o");
  }

  state.config = await response.json();
}

async function loadContents() {
  try {
    const response = await fetch("/api/contents?active=true", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Falha ao carregar conteÃºdos");
    }

    state.contents = await response.json();

    if (
      state.currentIndex >= state.contents.length
    ) {
      state.currentIndex = 0;
    }

    setConnectionStatus(true);
    showCurrentContent();
  } catch (error) {
    setConnectionStatus(false);
    renderMessage("NÃ£o foi possÃ­vel carregar os conteÃºdos.");
    console.error(error);
  }
}

function clearRotationTimer() {
  if (state.rotationTimer) {
    clearTimeout(state.rotationTimer);
    state.rotationTimer = null;
  }
}

function scheduleNext(content) {
  clearRotationTimer();

  const duration =
    Number(content?.duration) ||
    Number(state.config.defaultRotationSeconds) ||
    10;

  state.rotationTimer = setTimeout(() => {
    state.currentIndex =
      (state.currentIndex + 1) % state.contents.length;

    showCurrentContent();
  }, duration * 1000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderText(content) {
  return `
    <article class="content-card">
      <h2>${escapeHtml(content.title)}</h2>
      <p>${escapeHtml(content.body)}</p>
    </article>
  `;
}

function renderImage(content) {
  return `
    <article class="content-card">
      ${
        content.title
          ? `<h2>${escapeHtml(content.title)}</h2>`
          : ""
      }

      <img
        class="media-content"
        src="${escapeHtml(content.mediaUrl)}"
        alt="${escapeHtml(content.title)}"
      >
    </article>
  `;
}

function renderVideo(content) {
  return `
    <article class="content-card">
      ${
        content.title
          ? `<h2>${escapeHtml(content.title)}</h2>`
          : ""
      }

      <video
        class="media-content"
        src="${escapeHtml(content.mediaUrl)}"
        autoplay
        muted
        playsinline
        controls
      ></video>
    </article>
  `;
}

function renderHtml(content) {
  return `
    <article class="content-card html-content">
      ${
        content.title
          ? `<h2>${escapeHtml(content.title)}</h2>`
          : ""
      }

      <div>${content.body || ""}</div>
    </article>
  `;
}

function renderUrl(content) {
  return `
    <article class="content-card">
      <iframe
        class="url-content"
        src="${escapeHtml(content.url)}"
        title="${escapeHtml(content.title)}"
        loading="eager"
      ></iframe>
    </article>
  `;
}

function renderContent(content) {
  switch (content.type) {
    case "image":
      return renderImage(content);

    case "video":
      return renderVideo(content);

    case "html":
      return renderHtml(content);

    case "url":
      return renderUrl(content);

    case "text":
    default:
      return renderText(content);
  }
}

function renderMessage(message) {
  stage.innerHTML = `
    <div class="loading">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function showCurrentContent() {
  if (!state.contents.length) {
    clearRotationTimer();

    renderMessage("Nenhum conteÃºdo ativo.");
    counter.textContent = "0 / 0";
    lastUpdate.textContent = "Sem conteÃºdo";

    return;
  }

  const content = state.contents[state.currentIndex];

  stage.innerHTML = renderContent(content);

  counter.textContent =
    `${state.currentIndex + 1} / ${state.contents.length}`;

  lastUpdate.textContent =
    `Atualizado em ${new Date().toLocaleTimeString("pt-BR")}`;

  scheduleNext(content);
}

async function initialize() {
  try {
    await loadConfig();
    await loadContents();

    state.refreshTimer = setInterval(
      loadContents,
      Number(state.config.contentRefreshSeconds || 30) * 1000
    );
  } catch (error) {
    setConnectionStatus(false);
    renderMessage("Erro ao inicializar o sistema.");
    console.error(error);
  }
}

initialize();
