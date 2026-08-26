/**
 * Proof TDEP 0.1 de lab — HMAC fixture, sem audiência, sem Player-AD.
 * Chave `tdep-0.1-lab-not-product` é a mesma do Python. Não vai no instalador.
 */

import { createHash, createHmac, randomUUID } from 'crypto';

export const LAB_TDEP_HMAC_KEY = 'tdep-0.1-lab-not-product';
export const LAB_SELLER_PARTNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const LAB_FACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const LAB_CREATIVE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const LAB_FLIGHT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export interface LabTdepProof {
  schema: 'tdep/0.1';
  proof_id: string;
  face_id: string;
  creative_id: string;
  flight_id: string;
  played_at: string;
  duration_ms: number;
  player_hash: string;
  seller_sig: string;
}

const LEAK = ['audience', 'person_id', 'ace', 'mood'];

export function labHmac(parts: string[]): string {
  return createHmac('sha256', LAB_TDEP_HMAC_KEY).update(parts.join('|')).digest('hex');
}

export function playerHashForItem(itemId: string): string {
  return createHash('sha256').update(`lab-mock:${itemId}`).digest('hex');
}

export function proofHasAudienceLeak(proof: Record<string, unknown>): boolean {
  return LEAK.some((k) => k in proof);
}

export function signLabTdepProof(itemId: string, playedAt = new Date().toISOString()): LabTdepProof {
  const player_hash = playerHashForItem(itemId);
  const proof: LabTdepProof = {
    schema: 'tdep/0.1',
    proof_id: randomUUID(),
    face_id: LAB_FACE_ID,
    creative_id: LAB_CREATIVE_ID,
    flight_id: LAB_FLIGHT_ID,
    played_at: playedAt,
    duration_ms: 15000,
    player_hash,
    seller_sig: labHmac([LAB_SELLER_PARTNER_ID, LAB_FLIGHT_ID, player_hash]),
  };
  return proof;
}

export function verifyLabTdepProof(proof: LabTdepProof | Record<string, unknown> | null | undefined): boolean {
  if (!proof || typeof proof !== 'object') {
    return false;
  }
  if (proofHasAudienceLeak(proof as Record<string, unknown>)) {
    return false;
  }
  const row = proof as LabTdepProof;
  if (row.schema !== 'tdep/0.1' || !row.seller_sig || !row.player_hash) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/.test(row.player_hash)) {
    return false;
  }
  const expected = labHmac([LAB_SELLER_PARTNER_ID, String(row.flight_id), row.player_hash]);
  return row.seller_sig === expected;
}
