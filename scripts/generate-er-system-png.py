#!/usr/bin/env python3
"""
Gera PNG do modelo de dados completo (schema v2 refatorado):
- Saída principal: clusters = ficheiros part*.sql; dentro de cada cluster,
  lista em tabela HTML todas as CREATE TABLE (diagrama completo legível).
- Saída opcional --detalhe: um nó por tabela (ficheiro muito largo; para zoom).
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATABASE = REPO / "database"
OUT_DIR = REPO / "docs" / "diagrams"
OUT_CLUSTER = OUT_DIR / "SmartSignage-ER-sistema-completo.png"
OUT_DETAIL = OUT_DIR / "SmartSignage-ER-sistema-completo-detalhe.png"
OUT_DOT_CLUSTER = OUT_DIR / "SmartSignage-ER-sistema-completo.dot"
OUT_DOT_DETAIL = OUT_DIR / "SmartSignage-ER-sistema-completo-detalhe.dot"

PART_FILES = sorted(DATABASE.glob("smartchannel-db-v2-refactored-part*.sql"))
CREATE_RE = re.compile(r"^CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(", re.MULTILINE)


def extract_tables(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return CREATE_RE.findall(text)


def html_cluster_label(part_key: str, tables: list[str]) -> str:
    rows = "".join(f"<TR><TD ALIGN='LEFT'>{t}</TD></TR>" for t in tables)
    return (
        f"<<TABLE BORDER='0' CELLBORDER='1' CELLSPACING='0' CELLPADDING='3'>"
        f"<TR><TD BGCOLOR='#d6e3f7' COLSPAN='1'><B>{part_key}</B><BR/>"
        f"<FONT POINT-SIZE='9'>({len(tables)} tabelas)</FONT></TD></TR>"
        f"{rows}</TABLE>>"
    )


def write_cluster_dot(clusters: dict[str, list[str]], path: Path) -> None:
    node_ids = [f"n_{i}" for i in range(len(clusters))]
    lines = [
        "digraph SmartSignageERClusters {",
        '  graph [rankdir=TB; bgcolor=white; fontsize=12; dpi=150;',
        '        label="SmartSignage Pro — modelo de dados completo (por ficheiro schema v2)\\n'
        "Cada caixa lista todas as tabelas definidas nesse part*.sql\";",
        "        labelloc=t; labeljust=l; nodesep=0.35; ranksep=0.6;]",
        '  node [fontname="Helvetica"];',
        '  edge [color="#333333"];',
        "",
    ]
    items = sorted(clusters.items(), key=lambda x: x[0])
    for i, (part_key, tables) in enumerate(items):
        nid = node_ids[i]
        label = html_cluster_label(part_key, tables)
        lines.append(f'  {nid} [shape=plaintext label={label}];')
    for i in range(len(items) - 1):
        lines.append(f"  {node_ids[i]} -> {node_ids[i + 1]} [weight=10];")
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_detail_dot(clusters: dict[str, list[str]], table_to_part: dict[str, str], path: Path) -> None:
    all_tables = set(table_to_part.keys())
    lines = [
        "digraph SmartSignageERDetail {",
        '  graph [rankdir=TB; splines=spline; fontsize=10; dpi=140; bgcolor=white;',
        '        label="SmartSignage Pro — todas as tabelas (nós individuais)\\n'
        "Legível com zoom; prefira o PNG por clusters para visão geral\";",
        "        labelloc=t; labeljust=l; nodesep=0.1; ranksep=0.45;]",
        '  node [shape=box; style="filled,rounded"; fillcolor="#f7f9fc"; fontname="Helvetica"; fontsize=7];',
        '  edge [color="#555555"; arrowsize=0.5];',
        "",
    ]
    for part_key, tables in sorted(clusters.items()):
        lines.append(f'  subgraph "cluster_{part_key}" {{')
        lines.append(f'    label="{part_key}"; style=filled; color="#e8eef7"; fontname="Helvetica Bold";')
        for t in tables:
            lines.append(f'    "{t}";')
        lines.append("  }")
        lines.append("")

    part_order = sorted(clusters.keys())
    for i in range(len(part_order) - 1):
        a0 = clusters[part_order[i]][0]
        b0 = clusters[part_order[i + 1]][0]
        lines.append(f'  "{a0}" -> "{b0}" [style=invis weight=100];')

    edges = [
        ("publishers", "locals"),
        ("locals", "totems"),
        ("totems", "smart_tvs"),
        ("subscribers", "medias"),
        ("subscribers", "playlists"),
        ("subscribers", "campaigns"),
        ("subscribers", "subscriber_contracts"),
        ("subscribers", "subscriber_billing"),
        ("subscribers", "subscriber_publisher_access"),
        ("publishers", "publisher_billing"),
        ("publishers", "publisher_contracts"),
        ("publishers", "subscriptions"),
        ("plans", "plan_publisher_access"),
        ("plans", "subscriber_contracts"),
        ("campaigns", "campaign_playlists"),
        ("campaigns", "campaign_medias"),
        ("campaigns", "campaign_totems"),
        ("campaigns", "campaign_publishers"),
        ("campaigns", "campaign_locals"),
        ("playlists", "playlist_items"),
        ("playlist_items", "medias"),
        ("campaign_playlists", "playlists"),
        ("campaign_medias", "medias"),
        ("campaign_totems", "totems"),
        ("campaign_publishers", "publishers"),
        ("subscriber_publisher_access", "publishers"),
        ("subscriber_publisher_access", "subscribers"),
        ("totems", "totem_playlists"),
        ("totem_playlists", "totem_playlist_items"),
        ("totem_playlist_items", "medias"),
        ("users", "user_roles"),
        ("user_roles", "roles"),
        ("roles", "role_permissions"),
        ("role_permissions", "permissions"),
        ("dispatcher_decisions", "dispatcher_decision_campaigns"),
        ("dispatcher_decisions", "dispatcher_decision_items"),
        ("dispatcher_log", "dispatcher_decisions"),
        ("export_schedules", "export_executions"),
        ("reports", "report_templates"),
    ]
    lines.append("  // FKs principais (subconjunto)")
    for a, b in edges:
        if a in all_tables and b in all_tables:
            lines.append(f'  "{a}" -> "{b}";')
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_dot(dot_path: Path, png_path: Path) -> None:
    subprocess.run(
        ["dot", "-Tpng", str(dot_path), "-o", str(png_path)],
        check=True,
        capture_output=True,
        text=True,
    )


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--detalhe",
        action="store_true",
        help="Gera também o PNG com um nó por tabela (ficheiro largo).",
    )
    args = p.parse_args()

    table_to_part: dict[str, str] = {}
    for path in PART_FILES:
        key = path.name.replace("smartchannel-db-v2-refactored-", "").replace(".sql", "")
        for t in extract_tables(path):
            table_to_part.setdefault(t, key)

    clusters: dict[str, list[str]] = {}
    for t, part in table_to_part.items():
        clusters.setdefault(part, []).append(t)
    for k in clusters:
        clusters[k] = sorted(clusters[k])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_cluster_dot(clusters, OUT_DOT_CLUSTER)
    run_dot(OUT_DOT_CLUSTER, OUT_CLUSTER)
    print(f"OK (visão geral): {OUT_CLUSTER} ({OUT_CLUSTER.stat().st_size // 1024} KB)")

    if args.detalhe:
        write_detail_dot(clusters, table_to_part, OUT_DOT_DETAIL)
        run_dot(OUT_DOT_DETAIL, OUT_DETAIL)
        print(f"OK (detalhe): {OUT_DETAIL} ({OUT_DETAIL.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
