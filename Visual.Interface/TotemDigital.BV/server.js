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
      error: "NÃ£o autorizado"
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
        error: "ConteÃºdo nÃ£o encontrado"
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
          error: "ConteÃºdo nÃ£o encontrado"
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
          error: "ConteÃºdo nÃ£o encontrado"
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
