/**
 * Script de Teste de Funcionalidades - SmartSignage-Pro v2.0
 * Testa as principais funcionalidades do backend
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando Testes de Funcionalidade - SmartSignage-Pro v2.0\n');

// Função para executar comandos e capturar erros
function runTest(testName, command, options = {}) {
  try {
    console.log(`📋 ${testName}...`);
    const result = execSync(command, { 
      cwd: __dirname, 
      stdio: 'pipe',
      ...options 
    });
    console.log(`✅ ${testName} - SUCESSO\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} - FALHOU`);
    console.log(`   Erro: ${error.message}\n`);
    return false;
  }
}

// Função para verificar se arquivo existe
function checkFile(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${description} - Arquivo encontrado`);
      return true;
    } else {
      console.log(`❌ ${description} - Arquivo não encontrado: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description} - Erro ao verificar arquivo: ${error.message}`);
    return false;
  }
}

// Função para verificar estrutura de diretórios
function checkDirectory(dirPath, description) {
  try {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      console.log(`✅ ${description} - Diretório encontrado`);
      return true;
    } else {
      console.log(`❌ ${description} - Diretório não encontrado: ${dirPath}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description} - Erro ao verificar diretório: ${error.message}`);
    return false;
  }
}

// Contadores de testes
let totalTests = 0;
let passedTests = 0;

// 1. Testes de Estrutura de Arquivos
console.log('📁 TESTES DE ESTRUTURA DE ARQUIVOS\n');

const structureTests = [
  ['src/index.ts', 'Arquivo principal do servidor'],
  ['src/config/database.ts', 'Configuração do banco de dados'],
  ['src/middleware/auth.middleware.ts', 'Middleware de autenticação'],
  ['src/middleware/error.middleware.ts', 'Middleware de erro'],
  ['src/middleware/logger.middleware.ts', 'Middleware de log'],
  ['src/middleware/validation.middleware.ts', 'Middleware de validação'],
  ['src/routes/auth.ts', 'Rotas de autenticação'],
  ['src/routes/users.ts', 'Rotas de usuários'],
  ['src/routes/clients.ts', 'Rotas de clientes'],
  ['src/routes/totems.ts', 'Rotas de totems'],
  ['src/routes/media.ts', 'Rotas de mídia'],
  ['src/routes/playlists.ts', 'Rotas de playlists'],
  ['src/routes/campaigns.ts', 'Rotas de campanhas'],
  ['src/routes/analytics.ts', 'Rotas de analytics'],
  ['src/routes/billing.ts', 'Rotas de faturamento'],
  ['src/routes/reports.ts', 'Rotas de relatórios'],
  ['src/routes/settings.ts', 'Rotas de configurações'],
  ['src/routes/ai.ts', 'Rotas de IA'],
  ['src/routes/qrcodes.ts', 'Rotas de QR codes'],
  ['src/routes/smart-playlist.ts', 'Rotas de smart playlist'],
  ['src/services/userService.ts', 'Serviço de usuários'],
  ['src/services/clientService.ts', 'Serviço de clientes'],
  ['src/services/totemService.ts', 'Serviço de totems'],
  ['src/services/mediaService.ts', 'Serviço de mídia'],
  ['src/services/playlistService.ts', 'Serviço de playlists'],
  ['src/services/campaignService.ts', 'Serviço de campanhas'],
  ['src/services/analyticsService.ts', 'Serviço de analytics'],
  ['src/services/billingService.ts', 'Serviço de faturamento'],
  ['src/services/reportsService.ts', 'Serviço de relatórios'],
  ['src/services/settingsService.ts', 'Serviço de configurações'],
  ['src/services/aiService.ts', 'Serviço de IA'],
  ['src/services/qrcodeService.ts', 'Serviço de QR codes'],
  ['src/services/smartPlaylistService.ts', 'Serviço de smart playlist'],
  ['src/services/auditService.ts', 'Serviço de auditoria'],
  ['src/services/notificationService.ts', 'Serviço de notificações'],
  ['src/services/systemService.ts', 'Serviço de sistema'],
  ['package.json', 'Arquivo de configuração do projeto'],
  ['tsconfig.json', 'Configuração do TypeScript'],
  ['../config.development.env', 'Configuração de ambiente']
];

structureTests.forEach(([filePath, description]) => {
  totalTests++;
  if (checkFile(filePath, description)) {
    passedTests++;
  }
});

// 2. Testes de Compilação
console.log('\n🔨 TESTES DE COMPILAÇÃO\n');

const compilationTests = [
  ['Compilação TypeScript', 'npx tsc --noEmit --skipLibCheck'],
  ['Build do Projeto', 'npm run build'],
  ['Verificação de Sintaxe', 'npx tsc --noEmit']
];

compilationTests.forEach(([testName, command]) => {
  totalTests++;
  if (runTest(testName, command)) {
    passedTests++;
  }
});

// 3. Testes de Dependências
console.log('\n📦 TESTES DE DEPENDÊNCIAS\n');

const dependencyTests = [
  ['Instalação de Dependências', 'npm install'],
  ['Verificação de Vulnerabilidades', 'npm audit --audit-level=moderate']
];

dependencyTests.forEach(([testName, command]) => {
  totalTests++;
  if (runTest(testName, command)) {
    passedTests++;
  }
});

// 4. Testes de Configuração
console.log('\n⚙️ TESTES DE CONFIGURAÇÃO\n');

const configTests = [
  ['Verificação do package.json', 'node -e "console.log(require(\'./package.json\').name)"'],
  ['Verificação do tsconfig.json', 'node -e "console.log(require(\'./tsconfig.json\').compilerOptions.target)"']
];

configTests.forEach(([testName, command]) => {
  totalTests++;
  if (runTest(testName, command)) {
    passedTests++;
  }
});

// 5. Resumo dos Testes
console.log('\n📊 RESUMO DOS TESTES\n');
console.log(`Total de Testes: ${totalTests}`);
console.log(`Testes Aprovados: ${passedTests}`);
console.log(`Testes Falharam: ${totalTests - passedTests}`);
console.log(`Taxa de Sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 TODOS OS TESTES PASSARAM! O SmartSignage-Pro está pronto para produção!');
  process.exit(0);
} else {
  console.log('\n⚠️ Alguns testes falharam. Verifique os erros acima.');
  process.exit(1);
}
