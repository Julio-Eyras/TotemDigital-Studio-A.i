#!/usr/bin/env bash

set -e

PROJECT_NAME="totemdigital-smart-signage"
INSTALL_DIR="${1:-$HOME/$PROJECT_NAME}"
PORT="${PORT:-3000}"

echo "=============================================="
echo " TotemDigital SmartSignage"
echo " Instalação automática"
echo "=============================================="
echo
echo "Diretório de instalação: $INSTALL_DIR"
echo

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "$ID"
  else
    echo "unknown"
  fi
}

install_node_debian() {
  echo "[1/6] Instalando dependências do sistema..."

  sudo apt-get update
  sudo apt-get install -y curl ca-certificates build-essential

  if ! command -v node >/dev/null 2>&1; then
    echo "[2/6] Instalando Node.js LTS..."

    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "[2/6] Node.js já está instalado."
  fi
}

verify_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "ERRO: Node.js não foi encontrado."
    echo "Instale Node.js 20 ou superior e execute novamente."
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERRO: npm não foi encontrado."
    exit 1
  fi

  NODE_VERSION="$(node -v | sed 's/v//' | cut -d. -f1)"

  if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERRO: é necessário Node.js 18 ou superior."
    exit 1
  fi

  echo "Node.js: $(node -v)"
  echo "npm: $(npm -v)"
}

create_directories() {
  echo "[3/6] Criando estrutura do projeto..."

  mkdir -p "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR/public"
  mkdir -p "$INSTALL_DIR/data"
}

create_package_json() {
  cat > "$INSTALL_DIR/package.json" <<'EOF'
{
  "name": "totemdigital-smart-signage",
  "version": "1.0.0",
  "description": "Núcleo SmartSignage TotemDigital",
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
    "morgan": "^1.10.0",
    "uuid": "^11.0.3"
  }
}
EOF
}

create_env_file() {
  cat > "$INSTALL_DIR/.env.example" <<'EOF'
PORT=3000
API_KEY=troque-esta-chave
CONTENT_REFRESH_SECONDS=30
DEFAULT_ROTATION_SECONDS=10
EOF

  cat > "$INSTALL_DIR/.env" <<EOF
PORT=$PORT
API_KEY=
CONTENT_REFRESH_SECONDS=30
DEFAULT_ROTATION_SECONDS=10
EOF
}

create_database_file() {
  cat > "$INSTALL_DIR/data/contents.json" <<'EOF'
[
  {
    "id": "welcome",
    "type": "text",
    "title": "Bem-vindo à TotemDigital",
    "body": "Conteúdo dinâmico para SmartSignage.",
    "duration": 8,
    "active": true,
    "priority": 1,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "promotion",
    "type": "text",
    "title": "Sua mensagem aqui",
    "body": "Este conteúdo pode ser atualizado por API.",
    "duration": 8,
    "active": true,
    "priority": 2,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
]
EOF
}

create_server() {
  cat > "$INSTALL_DIR/server.js" <<'EOF'
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
const DATA_FILE = path.join(__dirname, "data", "contents.json");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use(express.static(path.join(__dirname, "public")));

async function ensureDatabase() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readContents() {
  await ensureDatabase();

  const file = await fs.readFile(DATA_FILE, "utf8");

  try {
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function saveContents(contents) {
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(contents, null, 2),
    "utf8"
  );
}

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return next();
  }

  const receivedKey =
    req.headers["x-api-key"] ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!receivedKey || receivedKey !== API_KEY) {
    return res.status(401).json({
      error: "Não autorizado"
    });
  }

  next();
}

function sanitizeContent(input) {
  const allowedTypes = [
    "text",
    "image",
    "video",
    "html",
    "url"
  ];

  const type = allowedTypes.includes(input.type)
    ? input.type
    : "text";

  return {
    id: input.id || randomUUID(),
    type,
    title: String(input.title || ""),
    body: String(input.body || ""),
    url: String(input.url || ""),
    mediaUrl: String(input.mediaUrl || ""),
    duration: Number(input.duration || 10),
    priority: Number(input.priority || 0),
    active: input.active !== false,
    metadata: input.metadata || {},
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "totemdigital-smart-signage",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    brand: "TotemDigital",
    theme: {
      primary: "#F2B705",
      petroleum: "#073B4C",
      dark: "#061E26",
      light: "#F7FAFC"
    },
    defaultRotationSeconds: Number(
      process.env.DEFAULT_ROTATION_SECONDS || 10
    )
  });
});

app.get("/api/contents", async (req, res) => {
  const onlyActive = req.query.active !== "false";
  let contents = await readContents();

  if (onlyActive) {
    contents = contents.filter((item) => item.active);
  }

  contents.sort((a, b) => {
    return Number(a.priority || 0) - Number(b.priority || 0);
  });

  res.json(contents);
});

app.get("/api/contents/:id", async (req, res) => {
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
});

app.post(
  "/api/contents",
  requireApiKey,
  async (req, res) => {
    const contents = await readContents();
    const content = sanitizeContent(req.body);

    contents.push(content);
    await saveContents(contents);

    res.status(201).json(content);
  }
);

app.put(
  "/api/contents/:id",
  requireApiKey,
  async (req, res) => {
    const contents = await readContents();

    const index = contents.findIndex(
      (item) => item.id === req.params.id
    );

    if (index === -1) {
      return res.status(404).json({
        error: "Conteúdo não encontrado"
      });
    }

    const updated = sanitizeContent({
      ...contents[index],
      ...req.body,
      id: contents[index].id,
      createdAt: contents[index].createdAt
    });

    contents[index] = updated;
    await saveContents(contents);

    res.json(updated);
  }
);

app.delete(
  "/api/contents/:id",
  requireApiKey,
  async (req, res) => {
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
  }
);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

await ensureDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==============================================");
  console.log(" TotemDigital SmartSignage iniciado");
  console.log("==============================================");
  console.log(` URL local: http://localhost:${PORT}`);
  console.log(` API:       http://localhost:${PORT}/api/contents`);
  console.log("");
});
EOF
}

create_html() {
  cat > "$INSTALL_DIR/public/index.html" <<'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>TotemDigital SmartSignage</title>

  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <main class="signage-shell">
    <header class="brand-header">
      <div class="brand-mark">
        <span class="brand-icon">TD</span>

        <div>
          <h1>totemdigital</h1>
          <p>SmartSignage Platform</p>
        </div>
      </div>

      <div class="status-indicator">
        <span class="status-dot"></span>
        <span id="connection-status">Conectando</span>
      </div>
    </header>

    <section id="content-stage" class="content-stage">
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Carregando conteúdo...</p>
      </div>
    </section>

    <footer class="signage-footer">
      <span id="content-counter">0 / 0</span>
      <span id="last-update">Aguardando atualização</span>
    </footer>
  </main>

  <script src="/app.js"></script>
</body>
</html>
EOF
}

create_css() {
  cat > "$INSTALL_DIR/public/style.css" <<'EOF'
:root {
  --gold: #f2b705;
  --gold-light: #ffd75a;
  --petroleum: #073b4c;
  --petroleum-light: #0d5267;
  --dark: #061e26;
  --white: #ffffff;
  --muted: #9db5bb;
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
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color: var(--white);
  background:
    radial-gradient(
      circle at 10% 10%,
      rgba(242, 183, 5, 0.2),
      transparent 32%
    ),
    linear-gradient(
      135deg,
      var(--dark) 0%,
      var(--petroleum) 100%
    );
}

.signage-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  padding: clamp(22px, 4vw, 72px);
}

.brand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.brand-mark {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  color: var(--dark);
  font-weight: 900;
  font-size: 17px;
  letter-spacing: -1px;
  border-radius: 16px;
  background: var(--gold);
  box-shadow: 0 10px 30px rgba(242, 183, 5, 0.25);
}

.brand-mark h1 {
  margin: 0;
  color: var(--gold);
  font-size: clamp(22px, 3vw, 42px);
  line-height: 1;
  letter-spacing: -1.5px;
}

.brand-mark p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: clamp(10px, 1vw, 14px);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 13px;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #65d48b;
  box-shadow: 0 0 14px #65d48b;
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
  padding: clamp(26px, 5vw, 80px);
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

.loading-state {
  text-align: center;
  color: var(--muted);
}

.loading-spinner {
  width: 42px;
  height: 42px;
  margin: 0 auto 16px;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.signage-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
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

  .brand-header {
    align-items: flex-start;
  }

  .status-indicator {
    font-size: 0;
  }

  .status-dot {
    width: 11px;
    height: 11px;
  }

  .content-card {
    padding: 28px;
    border-radius: 20px;
  }
}
EOF
}

create_javascript() {
  cat > "$INSTALL_DIR/public/app.js" <<'EOF'
const state = {
  contents: [],
  currentIndex: 0,
  timer: null,
  refreshTimer: null,
  config: {
    defaultRotationSeconds: 10
  }
};

const stage = document.querySelector("#content-stage");
const counter = document.querySelector("#content-counter");
const lastUpdate = document.querySelector("#last-update");
const connectionStatus = document.querySelector("#connection-status");

async function loadConfig() {
  const response = await fetch("/api/config");
  state.config = await response.json();
}

async function loadContents() {
  try {
    const response = await fetch("/api/contents?active=true");

    if (!response.ok) {
      throw new Error("Falha ao carregar conteúdos");
    }

    state.contents = await response.json();
    state.currentIndex = 0;

    connectionStatus.textContent = "Online";
    await showCurrentContent();
  } catch (error) {
    connectionStatus.textContent = "Offline";
    renderError("Não foi possível carregar os conteúdos.");
    console.error(error);
  }
}

function clearRotationTimer() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

function scheduleNext(content) {
  clearRotationTimer();

  const duration =
    Number(content?.duration) ||
    Number(state.config.defaultRotationSeconds) ||
    10;

  state.timer = setTimeout(() => {
    state.currentIndex =
      (state.currentIndex + 1) % state.contents.length;

    showCurrentContent();
  }, duration * 1000);
}

function escapeHtml(value) {
  return String(value || "")
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
      />
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
  /*
   * Use este tipo somente para HTML confiável,
   * enviado por uma fonte administrativa controlada.
   */
  return `
    <article class="content-card html-content">
      ${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}
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

async function showCurrentContent() {
  if (!state.contents.length) {
    stage.innerHTML = `
      <div class="loading-state">
        <p>Nenhum conteúdo ativo.</p>
      </div>
    `;

    counter.textContent = "0 / 0";
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

function renderError(message) {
  stage.innerHTML = `
    <div class="loading-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

async function initialize() {
  try {
    await loadConfig();
    await loadContents();

    state.refreshTimer = setInterval(
      loadContents,
      Number(
        import.meta?.env?.CONTENT_REFRESH_SECONDS ||
        30000
      )
    );
  } catch (error) {
    renderError("Erro ao inicializar o sistema.");
    console.error(error);
  }
}

initialize();
EOF
}

create_readme() {
  cat > "$INSTALL_DIR/README.md" <<'EOF'
# TotemDigital SmartSignage

Núcleo inicial da plataforma SmartSignage com tema TotemDigital.

## Iniciar

```bash
npm install
npm start
