#!/usr/bin/env python3
"""
Emissor sintético ACE 0.1.

Lê os exemplos de docs/lab-ace/examples/, passa pelo Privacy Gateway local
e escreve JSONL em logs/ace-synthetic.jsonl.

Não chama Dispatcher, Player-AD, MQTT nem PostgreSQL.
Nos snapshots aceites, observed_at é reescrito para agora (senão os JSON
estáticos seriam sempre STALE_CONTEXT).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ace_gateway import EXAMPLES_DIR, REPO_ROOT, gateway_decide  # noqa: E402

VALID = (
    "01-vazio.json",
    "02-aproximacao-um.json",
    "03-grupo-atencao-alta.json",
    "04-interacao-nfc.json",
    "05-interacao-qr.json",
)
REFUSE_DEMOS = (
    "reject-identity-leak.json",
    "reject-tag-id.json",
    "reject-stale.json",
    "reject-low-confidence.json",
)


def load_example(name: str) -> dict:
    return json.loads((EXAMPLES_DIR / name).read_text(encoding="utf-8"))


def emit_record(source: str, decision: dict) -> dict:
    return {
        "emitted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": source,
        "status": decision["status"],
        "code": decision["code"],
        "errors": decision["errors"],
        "audience.context": decision["payload"] if decision["status"] == "accepted" else None,
        "refused_payload_keys": (
            sorted(decision["payload"].keys()) if decision["status"] == "refused" else None
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Emissor sintético ACE 0.1 (lab, sem Dispatcher).")
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "logs" / "ace-synthetic.jsonl",
        help="Ficheiro JSONL de saída (default: logs/ace-synthetic.jsonl)",
    )
    parser.add_argument(
        "--ace-off",
        action="store_true",
        help="Simula Direct default: tudo recusado com ACE_DISABLED",
    )
    parser.add_argument(
        "--valid-only",
        action="store_true",
        help="Só os exemplos válidos (com observed_at fresco)",
    )
    args = parser.parse_args()

    ace_enabled = not args.ace_off
    now = datetime.now(timezone.utc)
    records: list[dict] = []

    for name in VALID:
        payload = load_example(name)
        payload["context_id"] = str(uuid4())
        payload["session_id"] = f"ephemeral-{uuid4().hex[:8]}"
        decision = gateway_decide(
            payload,
            now=now,
            ace_enabled=ace_enabled,
            rewrite_observed_at=True,
        )
        records.append(emit_record(name, decision))

    if not args.valid_only:
        for name in REFUSE_DEMOS:
            payload = load_example(name)
            decision = gateway_decide(
                payload,
                now=now,
                ace_enabled=ace_enabled,
                rewrite_observed_at=(name == "reject-low-confidence.json"),
            )
            records.append(emit_record(name, decision))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    accepted = sum(1 for r in records if r["status"] == "accepted")
    refused = sum(1 for r in records if r["status"] == "refused")
    print(f"JSONL {args.out}")
    print(f"accepted={accepted} refused={refused} ace_enabled={ace_enabled}")
    for rec in records:
        print(f"  {rec['source']}: {rec['status']}" + (f" {rec['code']}" if rec["code"] else ""))

    if args.ace_off:
        return 0 if refused == len(records) and accepted == 0 else 1
    if accepted != len(VALID):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
