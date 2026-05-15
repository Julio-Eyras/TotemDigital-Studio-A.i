/**
 * Geração de payload PIX (BR Code / EMV) para QR estático com valor.
 * Referência: padrão BACEN — campos TLV simplificados.
 */

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function normalizeAscii(input: string, max: number): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, max)
    .toUpperCase();
}

export interface PixEmvParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
}

/** Retorna string copia-e-cola PIX (sem CRC final ainda aplicado internamente). */
export function buildPixCopyPaste(params: PixEmvParams): string {
  const key = params.pixKey.trim();
  if (!key) {
    throw new Error('Chave PIX não configurada');
  }

  const name = normalizeAscii(params.merchantName || 'SMARTCHANNEL', 25);
  const city = normalizeAscii(params.merchantCity || 'BRASIL', 15);
  const txid = (params.txid || 'FATURA').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'FATURA';

  const gui = tlv('00', 'br.gov.bcb.pix');
  const keyField = tlv('01', key);
  const merchantAccount = tlv('26', `${gui}${keyField}`);

  let payload =
    tlv('00', '01') +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986');

  if (params.amount != null && params.amount > 0) {
    payload += tlv('54', params.amount.toFixed(2));
  }

  payload += tlv('58', 'BR') + tlv('59', name) + tlv('60', city);
  payload += tlv('62', tlv('05', txid));

  const toCrc = `${payload}6304`;
  return `${toCrc}${crc16Ccitt(toCrc)}`;
}
