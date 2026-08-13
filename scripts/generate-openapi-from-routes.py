#!/usr/bin/env python3
"""
Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
Eyras Sistemas e Soluções — Todos os direitos reservados.

Inventário + OpenAPI 3.0 a partir dos routers Express.
  python scripts/generate-openapi-from-routes.py
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend" / "src"
ROUTES_DIR = BACKEND / "routes"
OUT_JSON_DOCS = ROOT / "docs" / "technical" / "openapi.json"
OUT_JSON_BE = BACKEND / "config" / "openapi-generated.json"
OUT_INVENTORY = ROOT / "docs" / "technical" / "07-API-INVENTARIO.md"
SWAGGER_ENHANCED = BACKEND / "config" / "swagger-enhanced.ts"
P0_JSON = BACKEND / "config" / "openapi-p0.json"

MOUNT_FILES = [
    BACKEND / "startup" / "registerCompactRoutes.ts",
    BACKEND / "startup" / "registerExtendedApiRoutes.ts",
    BACKEND / "index.ts",
]

PUBLIC_PREFIXES = (
    "/auth/login",
    "/auth/refresh",
    "/health",
    "/player/",
    "/player?",  # sentinel unused
)
PUBLIC_EXACT = {
    "/auth/login",
    "/auth/refresh",
    "/health",
    "/health/check",
    "/health/quick",
    "/dashboard/ui-context",
    "/debug/player-static",
    "/player-static/{path}",
    "/publish-board/resolve",
    "/financial-admin/pix/webhook",
}

METHOD_CALL_RE = re.compile(
    r"""router\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]""",
    re.IGNORECASE,
)
METHOD_CALL_NL_RE = re.compile(
    r"""router\.(get|post|put|patch|delete|options|head)\s*\(\s*\n\s*['"`]([^'"`]+)['"`]""",
    re.IGNORECASE,
)
ROUTE_CHAIN_RE = re.compile(
    r"""router\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*((?:\.\s*(?:get|post|put|patch|delete|options|head)\s*\([^;]*)+)""",
    re.IGNORECASE | re.DOTALL,
)
CHAIN_METHOD_RE = re.compile(r"\.\s*(get|post|put|patch|delete|options|head)\s*\(", re.I)
JSDOC_ROUTE_RE = re.compile(
    r"""@route\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)(?:\s*\n\s*\*\s*@desc\s+(.+))?""",
    re.IGNORECASE,
)
IMPORT_RE = re.compile(
    r"""import\s+(\w+)\s+from\s+['"](?:\.\./routes|\./routes)/([^'"]+)['"]""",
)
APP_USE_RE = re.compile(
    r"""app\.use\(\s*['"`](/api/[^'"`]+)['"`]""",
)
REQUIRE_MODULE_RE = re.compile(r"""requireModule\(\s*['"]([^'"]+)['"]""")
AUTH_MW_RE = re.compile(r"authMiddleware")
APP_METHOD_RE = re.compile(
    r"""app\.(get|post|put|patch|delete)\(\s*(?:/\^\\?/api\\?/([^/]+)|['"`](/api/[^'"`]+)['"`])""",
    re.IGNORECASE,
)


def express_to_openapi(path: str) -> str:
    p = path.strip()
    if not p.startswith("/"):
        p = "/" + p
    p = re.sub(r":([A-Za-z0-9_]+)\?", r"{\1}", p)
    p = re.sub(r":([A-Za-z0-9_]+)", r"{\1}", p)
    p = p.replace("*", "{wildcard}")
    p = re.sub(r"/{2,}", "/", p)
    if len(p) > 1 and p.endswith("/"):
        p = p[:-1]
    return p or "/"


def join_paths(mount: str, rel: str) -> str:
    rel_o = express_to_openapi(rel)
    mount_o = express_to_openapi(mount.replace("/api", "", 1) if mount.startswith("/api") else mount)
    if rel_o == "/":
        return mount_o if mount_o.startswith("/") else "/" + mount_o
    if mount_o in ("", "/"):
        return rel_o
    return (mount_o.rstrip("/") + rel_o).replace("//", "/")


def parse_imports(text: str) -> dict[str, str]:
    return {name: rel for name, rel in IMPORT_RE.findall(text)}


def parse_mounts(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    imports = parse_imports(text)
    mounts: list[dict] = []
    # Split roughly by app.use( to associate middleware + router symbol
    parts = re.split(r"(?=app\.use\()", text)
    for part in parts:
        m = APP_USE_RE.search(part)
        if not m:
            continue
        api_prefix = m.group(1)
        module = None
        mm = REQUIRE_MODULE_RE.search(part)
        if mm:
            module = mm.group(1)
        auth = bool(AUTH_MW_RE.search(part))
        router_file = None
        # last imported identifier mentioned in this block
        mentioned = re.findall(r"\b([A-Za-z][A-Za-z0-9]*)\b", part)
        for ident in reversed(mentioned):
            if ident in imports:
                router_file = imports[ident]
                break
        mounts.append(
            {
                "prefix": api_prefix,
                "file": router_file,
                "module": module,
                "auth": auth,
                "source": path.name,
            }
        )
    return mounts


def parse_route_file(rel: str) -> tuple[list[tuple[str, str]], dict[tuple[str, str], str]]:
    """Return (method, rel_path) list and jsdoc summaries keyed by (METHOD, fullish path)."""
    candidates = [
        ROUTES_DIR / f"{rel}.ts",
        ROUTES_DIR / rel / "index.ts",
    ]
    fp = next((c for c in candidates if c.is_file()), None)
    if not fp:
        return [], {}
    text = fp.read_text(encoding="utf-8")
    ops: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for method, rel_path in (*METHOD_CALL_RE.findall(text), *METHOD_CALL_NL_RE.findall(text)):
        key = (method.lower(), rel_path)
        if key not in seen:
            seen.add(key)
            ops.append(key)

    for rel_path, chain in ROUTE_CHAIN_RE.findall(text):
        for method in CHAIN_METHOD_RE.findall(chain):
            key = (method.lower(), rel_path)
            if key not in seen:
                seen.add(key)
                ops.append(key)

    summaries: dict[tuple[str, str], str] = {}
    for method, full_or_rel, desc in JSDOC_ROUTE_RE.findall(text):
        summary = (desc or "").strip().rstrip(".")
        summaries[(method.lower(), full_or_rel.strip())] = summary

    return ops, summaries


def is_public(openapi_path: str) -> bool:
    if openapi_path in PUBLIC_EXACT:
        return True
    if openapi_path.startswith("/player") and not openapi_path.startswith("/player/debug"):
        return True
    if openapi_path.startswith("/health"):
        return True
    return False


def tag_for(prefix: str) -> str:
    p = prefix.replace("/api/", "").strip("/")
    head = p.split("/")[0] if p else "misc"
    return {
        "auth": "Auth",
        "users": "Users",
        "publishers": "Publishers",
        "subscribers": "Subscribers",
        "subscriber-access": "Subscribers",
        "subscriber-billing": "Billing",
        "publisher-billing": "Billing",
        "billing": "Billing",
        "billing-control": "Billing",
        "financial-admin": "Billing",
        "subscriptions": "Billing",
        "plans": "Plans",
        "contracts": "Contracts",
        "media": "Media",
        "playlists": "Playlists",
        "playlist-mix": "PlaylistMix",
        "playlist-engine": "Playlists",
        "smart-playlist": "Playlists",
        "campaigns": "Campaigns",
        "totems": "Totems",
        "locals": "Locals",
        "players": "Players",
        "player": "Player",
        "player-apk": "Player",
        "dispatcher-totem": "Dispatcher",
        "dispatcher-debug": "Dispatcher",
        "settings": "Settings",
        "installation": "Installation",
        "dashboard": "Dashboard",
        "dashboard-layouts": "Dashboard",
        "analytics": "Analytics",
        "reports": "Reports",
        "ai": "AI",
        "smartdisplayfx": "SmartDisplayFX",
        "ota-updates": "OTA",
        "health": "Health",
        "debug": "Debug",
        "quick-publish": "Publish",
        "simple-publish": "Publish",
        "publish-templates": "Publish",
        "publish-board": "Publish",
        "menu-catalog": "Publish",
        "webhooks": "Webhooks",
        "qrcodes": "QRCodes",
        "qr-codes": "QRCodes",
        "roles": "Users",
        "permissions": "Users",
        "clients": "Subscribers",
        "smart-tvs": "Devices",
        "network": "Network",
        "logs": "Logs",
        "alerts": "Alerts",
        "email": "Email",
        "tags": "Tags",
        "notifications": "Notifications",
        "backups": "Backups",
        "export-queries": "Exports",
        "export-schedules": "Exports",
        "export-executions": "Exports",
        "advanced-schedules": "Dispatcher",
        "facial-recognition": "Deferred",
    }.get(head, head.replace("-", " ").title().replace(" ", ""))


def parse_enhanced_paths() -> set[tuple[str, str]]:
    text = SWAGGER_ENHANCED.read_text(encoding="utf-8")
    covered: set[tuple[str, str]] = set()
    # '/auth/login': { ... get: {
    path_blocks = re.finditer(
        r"""['"](/[^'"]+)['"]\s*:\s*\{""",
        text,
    )
    for m in path_blocks:
        p = m.group(1)
        if p.startswith("/api"):
            continue
        start = m.end()
        # naive slice until next top-level path or schemas
        nxt = re.search(r"""\n    ['"]/[^'"]+['"]\s*:""", text[start : start + 8000])
        chunk = text[start : start + (nxt.start() if nxt else 4000)]
        for method in ("get", "post", "put", "patch", "delete", "options", "head"):
            if re.search(rf"\b{method}\s*:", chunk):
                covered.add((method, p))
    return covered


def parse_p0_paths() -> set[tuple[str, str]]:
    if not P0_JSON.is_file():
        return set()
    p0 = json.loads(P0_JSON.read_text(encoding="utf-8"))
    covered: set[tuple[str, str]] = set()
    for path_key, item in (p0.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        for method, op in item.items():
            if method.lower() in ("get", "post", "put", "patch", "delete", "options", "head") and isinstance(op, dict):
                covered.add((method.lower(), path_key))
    return covered


def merge_openapi_overlay(base: dict, overlay: dict) -> dict:
    """Fundir paths (método a método) + components.schemas do overlay P0."""
    out = dict(base)
    base_paths = dict(out.get("paths") or {})
    for path_key, item in (overlay.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        current = dict(base_paths.get(path_key) or {})
        current.update(item)
        base_paths[path_key] = current
    out["paths"] = base_paths
    base_comp = dict(out.get("components") or {})
    overlay_comp = overlay.get("components") or {}
    schemas = dict(base_comp.get("schemas") or {})
    schemas.update(overlay_comp.get("schemas") or {})
    schemes = dict(base_comp.get("securitySchemes") or {})
    schemes.update(overlay_comp.get("securitySchemes") or {})
    out["components"] = {**base_comp, **{k: v for k, v in overlay_comp.items() if k not in ("schemas", "securitySchemes")}}
    out["components"]["schemas"] = schemas
    out["components"]["securitySchemes"] = schemes
    return out


def extra_index_ops() -> list[dict]:
    return [
        {
            "method": "get",
            "path": "/player-static/{path}",
            "tag": "Player",
            "summary": "Ficheiros estáticos do player-web (js/css/media)",
            "module": None,
            "auth_mw": False,
            "public": True,
            "file": "index.ts",
            "source": "index.ts",
        },
        {
            "method": "get",
            "path": "/debug/player-static",
            "tag": "Debug",
            "summary": "Diagnóstico de ficheiros do player no backend",
            "module": None,
            "auth_mw": False,
            "public": True,
            "file": "index.ts",
            "source": "index.ts",
        },
    ]


def build() -> tuple[list[dict], dict]:
    mounts: list[dict] = []
    for f in MOUNT_FILES:
        if f.is_file():
            mounts.extend(parse_mounts(f))

    # index.ts mounts for player/debug (APP_USE_RE works)
    ops_out: list[dict] = []
    seen_full: set[tuple[str, str]] = set()

    for mount in mounts:
        prefix = mount["prefix"]
        rel_file = mount["file"]
        if not rel_file:
            # limiter-only mounts like /api/player/token — skip if no router
            continue
        rel_ops, jsdocs = parse_route_file(rel_file)
        if not rel_ops:
            # still document the prefix as a mount with unknown verbs
            key = ("*", join_paths(prefix, "/"))
            if key not in seen_full:
                seen_full.add(("get", key[1]))
            continue
        for method, rel_path in rel_ops:
            full = join_paths(prefix, rel_path)
            key = (method, full)
            if key in seen_full:
                continue
            seen_full.add(key)
            summary = ""
            for (jm, jp), desc in jsdocs.items():
                jp_norm = express_to_openapi(jp.replace("/api", "", 1) if jp.startswith("/api") else jp)
                if jm == method and (jp_norm == full or jp.endswith(rel_path) or jp == rel_path):
                    summary = desc
                    break
            if not summary:
                summary = f"{method.upper()} {full}"
            ops_out.append(
                {
                    "method": method,
                    "path": full,
                    "tag": tag_for(prefix),
                    "summary": summary,
                    "module": mount["module"],
                    "auth_mw": bool(mount["auth"]),
                    "public": is_public(full),
                    "file": rel_file,
                    "source": mount["source"],
                }
            )

    for extra in extra_index_ops():
        key = (extra["method"], extra["path"])
        if key not in seen_full:
            seen_full.add(key)
            ops_out.append(extra)

    ops_out.sort(key=lambda o: (o["tag"], o["path"], o["method"]))

    paths: dict = {}
    tags_set: dict[str, str] = {}
    for op in ops_out:
        p = op["path"]
        method = op["method"]
        tags_set.setdefault(op["tag"], f"Rotas {op['tag']}")
        item = {
            "tags": [op["tag"]],
            "summary": op["summary"][:180],
            "operationId": re.sub(r"[^a-zA-Z0-9]+", "_", f"{method}_{p}").strip("_")[:80],
            "responses": {
                "200": {"description": "OK"},
                "401": {"description": "Não autenticado"},
                "403": {"description": "Sem permissão ou módulo desligado"},
            },
        }
        if op.get("module"):
            item["description"] = (
                f"Ficheiro `backend/src/routes/{op['file']}.ts`. "
                f"Módulo de instalação: `{op['module']}`."
            )
            item["x-installation-module"] = op["module"]
        else:
            item["description"] = f"Ficheiro `backend/src/routes/{op['file']}.ts`."
        if op["public"]:
            item["security"] = []
            item["responses"].pop("401", None)
        else:
            item["security"] = [{"bearerAuth": []}]
        params = re.findall(r"\{([A-Za-z0-9_]+)\}", p)
        if params:
            item["parameters"] = [
                {
                    "name": name,
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string"},
                }
                for name in params
            ]
        if method in ("post", "put", "patch"):
            item["requestBody"] = {
                "required": False,
                "content": {
                    "application/json": {
                        "schema": {"type": "object", "additionalProperties": True}
                    }
                },
            }
        paths.setdefault(p, {})[method] = item

    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": "TotemDigital Studio API",
            "version": "2.1.16",
            "description": (
                "Catálogo gerado automaticamente a partir dos routers Express "
                f"({date.today().isoformat()}). Paths relativos à base `/api`. "
                "Detalhe rico: swagger-enhanced.ts + overlay P0 (`openapi-p0.json`)."
            ),
            "contact": {
                "name": "Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções"
            },
            "license": {
                "name": "Proprietary — All rights reserved",
                "url": "https://github.com/Julio-Eyras/TotemDigital-Studio/blob/main/LICENSE",
            },
        },
        "servers": [
            {"url": "/api", "description": "API base (mesmo host)"},
            {"url": "https://dev.totemdigital.app.br/api", "description": "DEV"},
            {"url": "https://totemdigital.app.br/api", "description": "Produção"},
        ],
        "tags": [{"name": n, "description": d} for n, d in sorted(tags_set.items())],
        "paths": paths,
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            }
        },
    }
    return ops_out, spec


def write_inventory(ops: list[dict], spec: dict, covered_enhanced: set[tuple[str, str]]) -> None:
    by_tag: dict[str, list[dict]] = defaultdict(list)
    for op in ops:
        by_tag[op["tag"]].append(op)

    enhanced_ops = 0
    generated_only = 0
    rows_gap = []
    for op in ops:
        key = (op["method"], op["path"])
        if key in covered_enhanced:
            enhanced_ops += 1
        else:
            generated_only += 1
            rows_gap.append(op)

    lines = [
        "# Inventário da API TotemDigital Studio",
        "",
        f"**Gerado:** {date.today().isoformat()} · Backend **2.1.16** · branch `main`",
        "**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções",
        "",
        "Fonte: routers em `backend/src/routes/` montados em "
        "`registerCompactRoutes.ts`, `registerExtendedApiRoutes.ts` e `index.ts`.",
        "",
        "OpenAPI gerado: [`openapi.json`](./openapi.json) · regenerar: "
        "`python scripts/generate-openapi-from-routes.py`",
        "",
        "Swagger UI (só desenvolvimento): `/api-docs`",
        "",
        "## Resumo",
        "",
        f"| Métrica | Valor |",
        f"|---------|-------|",
        f"| Operações (método+path) | **{len(ops)}** |",
        f"| Paths OpenAPI | **{len(spec['paths'])}** |",
        f"| Tags | **{len(spec['tags'])}** |",
        f"| Já com detalhe (enhanced + P0) | {enhanced_ops} |",
        f"| Só stub gerado | {generated_only} |",
        "",
        "> Catálogo completo das rotas montadas. Schemas ricos: "
        "`swagger-enhanced.ts` (PlaylistMix/publishers) + `openapi-p0.json` (integração).",
        "",
        "## Por domínio",
        "",
    ]

    for tag in sorted(by_tag):
        items = by_tag[tag]
        lines.append(f"### {tag} ({len(items)})")
        lines.append("")
        lines.append("| Método | Path `/api`… | Módulo | Auth | Ficheiro |")
        lines.append("|--------|--------------|--------|------|----------|")
        for op in items:
            mod = op["module"] or "—"
            if op["public"]:
                auth = "público"
            elif op.get("auth_mw"):
                auth = "JWT (mount)"
            else:
                auth = "JWT (router)"
            lines.append(
                f"| {op['method'].upper()} | `{op['path']}` | `{mod}` | {auth} | `{op['file']}` |"
            )
        lines.append("")

    lines += [
        "## Detalhe OpenAPI",
        "",
        "- Stubs: `backend/src/config/openapi-generated.json` (todas as rotas).",
        "- Overlay P0 (integração fechada): `backend/src/config/openapi-p0.json` — "
        "login, player dispatch/sync/heartbeat, installation modules + multi-agency, "
        "quick-publish + subscriber-access/grant, dispatcher-totem + dispatcher-debug.",
        "- swagger-enhanced: PlaylistMix / publishers / subscribers (legado).",
        "- Runtime: `GET /api/openapi.json` = gerado + enhanced + P0.",
        "- Estático: [`openapi.json`](./openapi.json) = gerado + P0.",
        "",
        f"**{generated_only}** operações ainda só têm stub (200/401/403 genéricos).",
        "",
        "Próximos candidatos a schemas manuais: billing, OTA, campaigns, portal.",
        "",
        "## Convenções",
        "",
        "- Paths OpenAPI são relativos a `/api` (ex.: `/auth/login` = `POST /api/auth/login`).",
        "- `:id` Express → `{id}` OpenAPI.",
        "- `requireModule('x')` aparece na coluna Módulo (Direct Totem pode devolver 403).",
        "- Auth “JWT (mount)” = `authMiddleware` no `app.use`; “JWT (router)” = auth dentro do ficheiro de rotas.",
        "",
    ]
    OUT_INVENTORY.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ops, spec = build()
    covered = set()
    if SWAGGER_ENHANCED.is_file():
        covered |= parse_enhanced_paths()
    covered |= parse_p0_paths()
    OUT_JSON_DOCS.parent.mkdir(parents=True, exist_ok=True)
    generated_payload = json.dumps(spec, ensure_ascii=False, indent=2)
    OUT_JSON_BE.write_text(generated_payload + "\n", encoding="utf-8")
    docs_spec = spec
    if P0_JSON.is_file():
        docs_spec = merge_openapi_overlay(spec, json.loads(P0_JSON.read_text(encoding="utf-8")))
    OUT_JSON_DOCS.write_text(json.dumps(docs_spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_inventory(ops, spec, covered)
    print(f"OK {len(ops)} operações · {len(spec['paths'])} paths")
    print(f"   {OUT_INVENTORY.relative_to(ROOT)}")
    print(f"   {OUT_JSON_DOCS.relative_to(ROOT)}")
    print(f"   {OUT_JSON_BE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
