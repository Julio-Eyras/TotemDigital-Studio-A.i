/**
 * Validation Utilities - Smart Signage v2.1
 * Utilitários para validação de dados no frontend
 */

/**
 * Valida tamanho de arquivo
 */
export function validateFileSize(file: File, maxSizeBytes: number): { valid: boolean; error?: string } {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho: ${fileSizeMB}MB, Máximo permitido: ${maxSizeMB}MB`,
    };
  }
  return { valid: true };
}

/**
 * Valida tipo de arquivo
 */
export function validateFileType(file: File, allowedTypes: string[]): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Tipo: ${file.type}, Permitidos: ${allowedTypes.join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * Valida tamanho de payload JSON
 */
export function validatePayloadSize(data: any, maxSizeBytes: number): { valid: boolean; error?: string } {
  const jsonString = JSON.stringify(data);
  const sizeBytes = new Blob([jsonString]).size;

  if (sizeBytes > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    const payloadSizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Payload muito grande. Tamanho: ${payloadSizeMB}MB, Máximo permitido: ${maxSizeMB}MB`,
    };
  }
  return { valid: true };
}

/**
 * Valida email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Email inválido',
    };
  }
  return { valid: true };
}

/**
 * Valida URL
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'URL inválida',
    };
  }
}

/**
 * Valida string não vazia
 */
export function validateRequired(value: any, fieldName: string): { valid: boolean; error?: string } {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      error: `${fieldName} é obrigatório`,
    };
  }
  return { valid: true };
}

/**
 * Valida número
 */
export function validateNumber(value: any, min?: number, max?: number): { valid: boolean; error?: string } {
  const num = typeof value === 'number' ? value : parseFloat(value);
  
  if (isNaN(num)) {
    return {
      valid: false,
      error: 'Valor deve ser um número',
    };
  }

  if (min !== undefined && num < min) {
    return {
      valid: false,
      error: `Valor deve ser maior ou igual a ${min}`,
    };
  }

  if (max !== undefined && num > max) {
    return {
      valid: false,
      error: `Valor deve ser menor ou igual a ${max}`,
    };
  }

  return { valid: true };
}

/**
 * Valida tamanho de string
 */
export function validateStringLength(value: string, min?: number, max?: number): { valid: boolean; error?: string } {
  const length = value.length;

  if (min !== undefined && length < min) {
    return {
      valid: false,
      error: `Texto deve ter pelo menos ${min} caracteres`,
    };
  }

  if (max !== undefined && length > max) {
    return {
      valid: false,
      error: `Texto deve ter no máximo ${max} caracteres`,
    };
  }

  return { valid: true };
}

/**
 * Constantes de validação
 */
export const VALIDATION_CONSTANTS = {
  MAX_UPLOAD_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_PAYLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  ALLOWED_AUDIO_TYPES: ['audio/mp3', 'audio/wav', 'audio/ogg'],
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
  ],
};

