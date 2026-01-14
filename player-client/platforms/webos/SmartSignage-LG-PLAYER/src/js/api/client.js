/**
 * API Client - webOS
 * Importa e adapta o core API client para webOS
 */

// Para webOS, vamos usar o core diretamente
// Em produção, isso seria um bundle ou import

// Se APIClient do core estiver disponível, usar diretamente
if (typeof APIClient !== 'undefined') {
  // APIClient já está disponível globalmente
} else {
  // Fallback: definir métodos básicos se core não estiver disponível
  console.warn('APIClient core não disponível, usando fallback');
}
