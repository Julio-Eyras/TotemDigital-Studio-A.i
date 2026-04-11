/**
 * Helper functions para manipulação de caminhos de arquivos
 * Centraliza lógica complexa de normalização de URLs
 */

import path from 'path';

/**
 * Normaliza caminho de arquivo para URL de download
 * Converte caminho absoluto para URL relativa que o Nginx pode servir
 * 
 * Exemplos:
 *   /opt/smart-signage/public/assets/uploads/file.jpg -> /assets/uploads/file.jpg
 *   /home/user/project/public/assets/uploads/file.jpg -> /assets/uploads/file.jpg
 *   /assets/uploads/file.jpg -> /assets/uploads/file.jpg (já está correto)
 */
export function normalizeDownloadUrl(filePath: string | null | undefined): string {
  if (!filePath) {
    return '';
  }
  
  // Se já começa com /assets/, limpar e retornar
  if (filePath.startsWith('/assets/')) {
    // Remover duplicações de /assets/ no início e normalizar
    let cleaned = filePath.replace(/^\/assets+\//, '/assets/');
    // Remover duplicações de uploads/ no caminho
    cleaned = cleaned.replace(/uploads\/+/g, 'uploads/');
    // Normalizar separadores de caminho
    cleaned = path.posix.normalize(cleaned);
    return cleaned;
  }
  
  // Tentar extrair parte relativa após /public/assets/ ou /assets/
  let relativePath = filePath;
  
  // Caso 1: Caminho contém /public/assets/
  if (relativePath.includes('/public/assets/')) {
    const parts = relativePath.split('/public/assets/');
    if (parts.length > 1) {
      relativePath = parts[1];
    }
  }
  // Caso 2: Caminho contém /assets/ mas não /public/assets/
  else if (relativePath.includes('/assets/')) {
    const parts = relativePath.split('/assets/');
    if (parts.length > 1) {
      relativePath = parts[1];
    }
  }
  // Caso 3: Caminho absoluto sem /assets/ - extrair após 'uploads' ou último diretório
  else {
    const pathParts = relativePath.split(path.sep);
    const assetsIndex = pathParts.findIndex(part => part === 'assets' || part === 'uploads');
    if (assetsIndex >= 0 && assetsIndex < pathParts.length - 1) {
      relativePath = pathParts.slice(assetsIndex).join('/');
    } else {
      // Último recurso: extrair apenas após 'uploads'
      const uploadsIndex = relativePath.indexOf('uploads');
      if (uploadsIndex >= 0) {
        relativePath = relativePath.substring(uploadsIndex);
      } else {
        // Se não encontrou, usar apenas o nome do arquivo
        relativePath = path.basename(relativePath);
      }
    }
  }
  
  // Normalizar caminho usando path.posix para garantir separadores /
  relativePath = path.posix.normalize(relativePath);
  
  // Limpar duplicações
  relativePath = relativePath.replace(/uploads\/+/g, 'uploads/');
  relativePath = relativePath.replace(/\/+/g, '/');
  
  // Garantir que comece com /assets/
  if (!relativePath.startsWith('/assets/')) {
    relativePath = `/assets/${relativePath}`;
  }
  
  // Limpar duplicações finais novamente após adicionar /assets/
  relativePath = relativePath.replace(/^\/assets+\//, '/assets/');
  relativePath = relativePath.replace(/uploads\/+/g, 'uploads/');
  relativePath = path.posix.normalize(relativePath);
  
  return relativePath;
}

/**
 * Gera URL de thumbnail baseado no caminho do arquivo e tipo de mídia
 */
export function generateThumbnailUrl(filePath: string | null | undefined, mediaType: string): string {
  if (!filePath) {
    return '';
  }
  
  if (mediaType === 'image') {
    // Para imagens, substituir extensão por _thumb.jpg
    const ext = path.extname(filePath);
    const thumbnailPath = filePath.replace(ext, '_thumb.jpg');
    return normalizeDownloadUrl(thumbnailPath);
  }
  
  // Para outros tipos, retornar caminho original normalizado
  return normalizeDownloadUrl(filePath);
}
