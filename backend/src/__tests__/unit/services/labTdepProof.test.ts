import {
  labHmac,
  signLabTdepProof,
  verifyLabTdepProof,
  LAB_SELLER_PARTNER_ID,
  LAB_FLIGHT_ID,
} from '../../../services/lab/labTdepProof';

describe('Proof TDEP lab (HMAC fixture)', () => {
  it('assina e verifica; recusa leak e tamper', () => {
    const proof = signLabTdepProof('tdep-fill-mock');
    expect(verifyLabTdepProof(proof)).toBe(true);
    expect(proof.seller_sig).toBe(
      labHmac([LAB_SELLER_PARTNER_ID, LAB_FLIGHT_ID, proof.player_hash])
    );
    expect(verifyLabTdepProof({ ...proof, seller_sig: '00'.repeat(32) })).toBe(false);
    expect(verifyLabTdepProof({ ...proof, audience: { count: 1 } })).toBe(false);
  });
});
