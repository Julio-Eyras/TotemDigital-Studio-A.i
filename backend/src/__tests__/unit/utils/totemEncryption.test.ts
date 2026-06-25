import crypto from 'crypto';
import { decryptOpenSslSaltedBase64 } from '../../../utils/totemEncryption';

function encryptOpenSslSaltedBase64(plaintext: string, password: string): string {
  const salt = crypto.randomBytes(8);
  const derived = crypto.pbkdf2Sync(password, salt, 10000, 48, 'sha256');
  const key = derived.subarray(0, 32);
  const iv = derived.subarray(32, 48);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__'), salt, ciphertext]).toString('base64');
}

describe('decryptOpenSslSaltedBase64', () => {
  it('desencripta payload compatível com openssl enc -aes-256-cbc -pbkdf2', () => {
    const password = 'test-secret-key';
    const payload = 'DEMO-UIN-001:aa:bb:cc:dd:ee:ff:1710000000000';
    const encrypted = encryptOpenSslSaltedBase64(payload, password);
    expect(decryptOpenSslSaltedBase64(encrypted, password)).toBe(payload);
  });

  it('rejeita formato inválido', () => {
    expect(() => decryptOpenSslSaltedBase64('dGVzdA==', 'x')).toThrow(
      'Formato de configuração encriptada inválido'
    );
  });

  it('falha com senha incorreta', () => {
    const encrypted = encryptOpenSslSaltedBase64('uin:mac:1', 'right-key');
    expect(() => decryptOpenSslSaltedBase64(encrypted, 'wrong-key')).toThrow();
  });
});
