#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${1:-./TotemDigital.BV}"

echo "=============================================="
echo " TotemDigital SmartSignage"
echo " Geração dos arquivos-fonte"
echo "=============================================="
echo
echo "Diretório do projeto: $PROJECT_DIR"
echo

mkdir -p "$PROJECT_DIR/public"
mkdir -p "$PROJECT_DIR/data"

cat > "$PROJECT_DIR/package.json" <<'EOF'
{
  "name": "totemdigital-bv",
  "version": "1.0.0",
  "private": true,
  "description": "TotemDigital SmartSignage - BV",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "helmet": "^8.0.0",
    "morgan": "^1.10.0"
  }
}
EOF

cat > "$PROJECT_DIR/.env.example" <<'EOF'
PORT=3000
API_KEY=
CONTENT_REFRESH_SECONDS=30
DEFAULT_ROTATION_SECONDS=10
EOF

cat > "$PROJECT_DIR/data/contents.json" <<'EOF'
[
  {
    "id": "welcome",
    "type": "text",
    "title": "Bem-vindo à TotemDigital",
    "body": "Conteúdo dinâmico para SmartSignage.",
    "duration": 8,
    "priority": 1,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "promotion",
    "type": "text",
    "title": "Sua mensagem aqui",
    "body": "Este conteúdo pode ser atualizado pela API.",
    "duration": 8,
    "priority": 2,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
EOF

cat > "$PROJECT_DIR/server.js" <<'EOF'
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || "";
const DATA_FILE = path.join(__dirname, "data", "contents.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(express.static(PUBLIC_DIR));

async function ensureDatabase() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

async function readContents() {
  await ensureDatabase();

  const file = await fs.readFile(DATA_FILE, "utf8");

  try {
    const data = JSON.parse(file);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveContents(contents) {
  const temporaryFile = `${DATA_FILE}.tmp`;

  await fs.writeFile(
    temporaryFile,
    `${JSON.stringify(contents, null, 2)}\n`,
    "utf8"
  );

  await fs.rename(temporaryFile, DATA_FILE);
}

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return next();
  }

  const authorization = req.headers.authorization || "";
  const bearerKey = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  const receivedKey = req.headers["x-api-key"] || bearerKey;

  if (!receivedKey || receivedKey !== API_KEY) {
    return res.status(401).json({
      error: "Não autorizado"
    });
  }

  next();
}

function normalizeNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function sanitizeContent(input = {}, previous = {}) {
  const allowedTypes = ["text", "image", "video", "html", "url"];

  const type = allowedTypes.includes(input.type)
    ? input.type
    : previous.type || "text";

  return {
    id: previous.id || input.id || randomUUID(),
    type,
    title: String(input.title ?? previous.title ?? ""),
    body: String(input.body ?? previous.body ?? ""),
    url: String(input.url ?? previous.url ?? ""),
    mediaUrl: String(input.mediaUrl ?? previous.mediaUrl ?? ""),
    duration: Math.max(
      1,
      normalizeNumber(
        input.duration ?? previous.duration,
        10
      )
    ),
    priority: normalizeNumber(
      input.priority ?? previous.priority,
      0
    ),
    active:
      typeof input.active === "boolean"
        ? input.active
        : previous.active !== false,
    metadata:
      input.metadata &&
      typeof input.metadata === "object"
        ? input.metadata
        : previous.metadata || {},
    createdAt:
      previous.createdAt ||
      input.createdAt ||
      new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "totemdigital-bv",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    brand: "TotemDigital BV",
    defaultRotationSeconds: Number(
      process.env.DEFAULT_ROTATION_SECONDS || 10
    ),
    contentRefreshSeconds: Number(
      process.env.CONTENT_REFRESH_SECONDS || 30
    ),
    theme: {
      primary: "#F2B705",
      petroleum: "#073B4C",
      dark: "#061E26",
      light: "#F7FAFC"
    }
  });
});

app.get("/api/contents", async (req, res, next) => {
  try {
    const onlyActive = req.query.active !== "false";
    let contents = await readContents();

    if (onlyActive) {
      contents = contents.filter((content) => content.active === true);
    }

    contents.sort(
      (first, second) =>
        Number(first.priority || 0) -
        Number(second.priority || 0)
    );

    res.json(contents);
  } catch (error) {
    next(error);
  }
});

app.get("/api/contents/:id", async (req, res, next) => {
  try {
    const contents = await readContents();

    const content = contents.find(
      (item) => item.id === req.params.id
    );

    if (!content) {
      return res.status(404).json({
        error: "Conteúdo não encontrado"
      });
    }

    res.json(content);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/contents",
  requireApiKey,
  async (req, res, next) => {
    try {
      const contents = await readContents();
      const content = sanitizeContent(req.body);

      contents.push(content);
      await saveContents(contents);

      res.status(201).json(content);
    } catch (error) {
      next(error);
    }
  }
);

app.put(
  "/api/contents/:id",
  requireApiKey,
  async (req, res, next) => {
    try {
      const contents = await readContents();

      const index = contents.findIndex(
        (item) => item.id === req.params.id
      );

      if (index === -1) {
        return res.status(404).json({
          error: "Conteúdo não encontrado"
        });
      }

      contents[index] = sanitizeContent(
        req.body,
        contents[index]
      );

      await saveContents(contents);

      res.json(contents[index]);
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/contents/:id",
  requireApiKey,
  async (req, res, next) => {
    try {
      const contents = await readContents();

      const filtered = contents.filter(
        (item) => item.id !== req.params.id
      );

      if (filtered.length === contents.length) {
        return res.status(404).json({
          error: "Conteúdo não encontrado"
        });
      }

      await saveContents(filtered);

      res.json({
        success: true,
        deletedId: req.params.id
      });
    } catch (error) {
      next(error);
    }
  }
);

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    error: "Erro interno do servidor"
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

await ensureDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==============================================");
  console.log(" TotemDigital SmartSignage iniciado");
  console.log("==============================================");
  console.log(` URL local: http://localhost:${PORT}`);
  console.log(` API: http://localhost:${PORT}/api/contents`);
  console.log("");
});
EOF

cat > "$PROJECT_DIR/public/index.html" <<'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#061E26">
  <title>TotemDigital BV</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="signage-shell">
    <header class="brand-header">
      <div class="brand">
        <div class="brand-icon">TD</div>

        <div>
          <h1>totemdigital</h1>
          <p>SmartSignage Platform</p>
        </div>
      </div>

      <div class="connection">
        <span id="connection-dot" class="connection-dot offline"></span>
        <span id="connection-status">Conectando</span>
      </div>
    </header>

    <section id="content-stage" class="content-stage">
      <div class="loading">
        <div class="spinner"></div>
        <p>Carregando conteúdo...</p>
      </div>
    </section>

    <footer class="footer">
      <span id="content-counter">0 / 0</span>
      <span id="last-update">Aguardando atualização</span>
    </footer>
  </main>

  <script src="/app.js"></script>
</body>
</html>
EOF

cat > "$PROJECT_DIR/public/style.css" <<'EOF'
:root {
  --gold: #f2b705;
  --gold-light: #ffd75a;
  --petroleum: #073b4c;
  --dark: #061e26;
  --white: #ffffff;
  --muted: #a7bdc2;
  --success: #65d48b;
  --danger: #ff6b6b;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  color: var(--white);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  background:
    radial-gradient(
      circle at 10% 10%,
      rgba(242, 183, 5, 0.2),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      var(--dark),
      var(--petroleum)
    );
}

.signage-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  padding: clamp(24px, 4vw, 72px);
}

.brand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-icon {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  color: var(--dark);
  font-size: 17px;
  font-weight: 900;
  border-radius: 16px;
  background: var(--gold);
  box-shadow: 0 10px 30px rgba(242, 183, 5, 0.3);
}

.brand h1 {
  margin: 0;
  color: var(--gold);
  font-size: clamp(24px, 3vw, 42px);
  line-height: 1;
  letter-spacing: -1.5px;
}

.brand p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: clamp(10px, 1vw, 14px);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.connection {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 13px;
}

.connection-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.connection-dot.online {
  background: var(--success);
  box-shadow: 0 0 14px var(--success);
}

.connection-dot.offline {
  background: var(--danger);
  box-shadow: 0 0 14px var(--danger);
}

.content-stage {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: clamp(32px, 7vw, 100px) 0;
}

.content-card {
  width: min(100%, 1150px);
  max-height: 100%;
  padding: clamp(28px, 5vw, 80px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.07);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
  animation: card-in 500ms ease both;
}

.content-card h2 {
  margin: 0 0 24px;
  color: var(--gold-light);
  font-size: clamp(32px, 6vw, 88px);
  line-height: 1;
  letter-spacing: -3px;
}

.content-card p {
  max-width: 900px;
  margin: 0;
  color: #eef7f8;
  font-size: clamp(20px, 3vw, 48px);
  line-height: 1.25;
}

.media-content {
  display: block;
  width: 100%;
  max-height: 68vh;
  object-fit: contain;
  border-radius: 18px;
}

.html-content {
  color: white;
  font-size: clamp(18px, 2vw, 32px);
}

.url-content {
  width: 100%;
  height: 65vh;
  border: 0;
  border-radius: 18px;
  background: white;
}

.loading {
  color: var(--muted);
  text-align: center;
}

.spinner {
  width: 42px;
  height: 42px;
  margin: 0 auto 16px;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 600px) {
  .signage-shell {
    padding: 24px;
  }

  .connection {
    font-size: 0;
  }

  .connection-dot {
    width: 11px;
    height: 11px;
  }

  .content-card {
    padding: 28px;
    border-radius: 20px;
  }
}
EOF

cat > "$PROJECT_DIR/public/app.js" <<'EOF'
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
    throw new Error("Falha ao carregar configuração");
  }

  state.config = await response.json();
}

async function loadContents() {
  try {
    const response = await fetch("/api/contents?active=true", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Falha ao carregar conteúdos");
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
    renderMessage("Não foi possível carregar os conteúdos.");
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

    renderMessage("Nenhum conteúdo ativo.");
    counter.textContent = "0 / 0";
    lastUpdate.textContent = "Sem conteúdo";

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
EOF

cat > "$PROJECT_DIR/README.md" <<'EOF'
# TotemDigital BV

Projeto SmartSignage com geração apenas dos arquivos-fonte.

## Estrutura

- `server.js` — servidor Node.js
- `public/index.html` — interface
- `public/style.css` — estilos
- `public/app.js` — rotação dos conteúdos
- `data/contents.json` — conteúdos
- `.env.example` — exemplo de configuração

## Executar manualmente

Depois que as dependências já estiverem disponíveis no ambiente:

```bash
npm start
