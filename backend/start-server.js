/**
 * Script de Inicialização do Servidor - SmartSignage-Pro v2.0
 * Inicia o servidor e testa as funcionalidades básicas
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando Servidor SmartSignage-Pro v2.0\n');

// Verificar se o arquivo de configuração existe
const configPath = path.join(__dirname, '../config.development.env');
if (!fs.existsSync(configPath)) {
  console.log('❌ Arquivo de configuração não encontrado. Criando...');
  
  // Criar arquivo de configuração básico
  const basicConfig = `# Smart Signage v2.0 - Configuração de Desenvolvimento
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database - PostgreSQL
DB_DRIVER=postgresql
DATABASE_URL=postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage

# JWT
JWT_SECRET=dev-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=2GB
UPLOAD_MAX_SIZE=2GB
MAX_PAYLOAD_SIZE=0
ALLOWED_FILE_TYPES=image/jpeg,image/png,video/mp4

# Logs
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# AI (Opcional)
AI_PROVIDER=none
AI_MODEL=
OLLAMA_BASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
`;

  fs.writeFileSync(configPath, basicConfig);
  console.log('✅ Arquivo de configuração criado');
}

// Função para testar se o servidor está respondendo
function testServerHealth(port = 3000, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const testHealth = () => {
      attempts++;
      
      const http = require('http');
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Servidor está respondendo corretamente');
          resolve(true);
        } else {
          if (attempts < maxAttempts) {
            setTimeout(testHealth, 1000);
          } else {
            reject(new Error('Servidor não está respondendo corretamente'));
          }
        }
      });
      
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(testHealth, 1000);
        } else {
          reject(new Error('Servidor não está acessível'));
        }
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(testHealth, 1000);
        } else {
          reject(new Error('Timeout ao conectar com o servidor'));
        }
      });
    };
    
    testHealth();
  });
}

// Função para iniciar o servidor
function startServer() {
  console.log('📋 Iniciando servidor...');
  
  // Verificar se o build existe
  const buildPath = path.join(__dirname, 'dist');
  if (!fs.existsSync(buildPath)) {
    console.log('📋 Build não encontrado. Executando build...');
    try {
      require('child_process').execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
      console.log('✅ Build concluído');
    } catch (error) {
      console.log('❌ Erro no build:', error.message);
      return;
    }
  }
  
  // Iniciar o servidor
  const serverProcess = spawn('node', ['dist/index.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  serverProcess.stdout.on('data', (data) => {
    console.log(`📋 Servidor: ${data.toString().trim()}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.log(`⚠️ Erro do servidor: ${data.toString().trim()}`);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`📋 Servidor encerrado com código: ${code}`);
  });
  
  // Aguardar um pouco para o servidor inicializar
  setTimeout(async () => {
    try {
      await testServerHealth();
      console.log('\n🎉 Servidor SmartSignage-Pro v2.0 está funcionando perfeitamente!');
      console.log('📋 Acesse: http://localhost:3000');
      console.log('📋 Health Check: http://localhost:3000/health');
      console.log('📋 API Docs: http://localhost:3000/api-docs');
      console.log('\n⏹️ Pressione Ctrl+C para parar o servidor');
    } catch (error) {
      console.log(`❌ Erro ao testar servidor: ${error.message}`);
      console.log('📋 Verifique se o banco de dados está configurado corretamente');
    }
  }, 3000);
  
  // Capturar Ctrl+C para encerrar o servidor
  process.on('SIGINT', () => {
    console.log('\n📋 Encerrando servidor...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
}

// Iniciar o servidor
startServer();
