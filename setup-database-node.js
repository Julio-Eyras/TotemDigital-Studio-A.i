/**
 * Script Node.js para criar banco de dados e executar migrations
 * Funciona sem precisar do psql no PATH
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco
const ADMIN_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres' // Conecta no banco padrão primeiro
};

const DB_NAME = 'smartsignage';

// Lista de arquivos SQL na ordem correta
const SQL_FILES = [
  'database/smartchannel-db-v2-refactored-part1-schema-setup.sql',
  'database/smartchannel-db-v2-refactored-part2-tables-base.sql',
  'database/smartchannel-db-v2-refactored-part3-tables-dependent.sql',
  'database/smartchannel-db-v2-refactored-part4-billing-contracts.sql',
  'database/smartchannel-db-v2-refactored-part5-tables-relationships.sql',
  'database/smartchannel-db-v2-refactored-part6-tables-other.sql',
  'database/smartchannel-db-v2-refactored-part7-foreign-keys.sql',
  'database/smartchannel-db-v2-refactored-part8-indexes.sql',
  'database/smartchannel-db-v2-refactored-part9-triggers-functions.sql',
  'database/smartchannel-db-v2-refactored-part10-views.sql',
  'database/smartchannel-db-v2-refactored-part11-playlist-mix.sql',
  'database/smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql'
];

async function createDatabase() {
  const adminPool = new Pool(ADMIN_CONFIG);
  
  try {
    console.log('Conectando ao PostgreSQL como postgres...');
    await adminPool.query('SELECT NOW()');
    console.log('✓ Conexão estabelecida');
    
    // Verificar se banco já existe
    console.log(`\nVerificando se banco '${DB_NAME}' existe...`);
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DB_NAME]
    );
    
    if (dbCheck.rows.length > 0) {
      console.log(`✓ Banco '${DB_NAME}' já existe`);
    } else {
      console.log(`Criando banco '${DB_NAME}'...`);
      await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`✓ Banco '${DB_NAME}' criado com sucesso!`);
    }
    
    await adminPool.end();
    return true;
  } catch (error) {
    console.error('✗ Erro ao criar banco:', error.message);
    await adminPool.end();
    return false;
  }
}

async function executeSQLFile(pool, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ Arquivo não encontrado: ${filePath}`);
    return false;
  }
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Remover comandos \i e \echo que são específicos do psql
    const cleanSQL = sql
      .replace(/\\i\s+[^\n]+/g, '') // Remove \i commands
      .replace(/\\echo\s+[^\n]+/g, '') // Remove \echo commands
      .replace(/\\\n/g, '\n'); // Remove \ no final de linha
    
    // Dividir em comandos (por ;)
    const commands = cleanSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    for (const command of commands) {
      if (command.trim().length > 0) {
        try {
          await pool.query(command);
        } catch (err) {
          // Ignorar erros de "já existe" ou "não existe"
          if (!err.message.includes('already exists') && 
              !err.message.includes('does not exist') &&
              !err.message.includes('duplicate key')) {
            console.log(`    ⚠ Aviso: ${err.message.split('\n')[0]}`);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.log(`  ✗ Erro ao executar ${filePath}: ${error.message}`);
    return false;
  }
}

async function setupSchema() {
  const pool = new Pool({
    ...ADMIN_CONFIG,
    database: DB_NAME
  });
  
  try {
    console.log(`\nConectando ao banco '${DB_NAME}'...`);
    await pool.query('SELECT NOW()');
    console.log('✓ Conectado');
    
    console.log('\nExecutando scripts SQL...\n');
    
    for (let i = 0; i < SQL_FILES.length; i++) {
      const file = SQL_FILES[i];
      console.log(`[${i + 1}/${SQL_FILES.length}] ${file}`);
      await executeSQLFile(pool, file);
      console.log(`  ✓ Concluído\n`);
    }
    
    // Executar seeds se existir
    const seedsPath = path.join(__dirname, 'database', 'seeds-default-settings.sql');
    if (fs.existsSync(seedsPath)) {
      console.log('Executando seeds (dados iniciais)...');
      await executeSQLFile(pool, seedsPath);
      console.log('  ✓ Seeds executados\n');
    }
    
    await pool.end();
    return true;
  } catch (error) {
    console.error('✗ Erro ao configurar schema:', error.message);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Smart Signage Pro - Setup do Banco');
  console.log('========================================\n');
  
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    console.error('\nFalha ao criar banco de dados. Verifique as credenciais.');
    process.exit(1);
  }
  
  const schemaSetup = await setupSchema();
  if (!schemaSetup) {
    console.error('\nFalha ao configurar schema.');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('✓ Banco de dados configurado com sucesso!');
  console.log('========================================\n');
}

main().catch(console.error);

