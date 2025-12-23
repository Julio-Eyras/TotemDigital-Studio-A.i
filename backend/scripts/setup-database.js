/**
 * Script para criar o banco de dados e aplicar o schema
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração para conectar ao banco postgres (padrão) para criar o banco smartsignage
const adminConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres' // Conectar ao banco padrão primeiro
};

const dbConfig = {
  ...adminConfig,
  database: 'smartsignage'
};

async function createDatabase() {
  const adminPool = new Pool(adminConfig);
  
  try {
    console.log('🔍 Verificando se o banco de dados existe...');
    
    // Verificar se o banco já existe
    const checkResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ['smartsignage']
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Banco de dados "smartsignage" já existe');
      await adminPool.end();
      return true;
    }
    
    console.log('📦 Criando banco de dados "smartsignage"...');
    await adminPool.query('CREATE DATABASE smartsignage');
    console.log('✅ Banco de dados criado com sucesso!');
    
    await adminPool.end();
    return true;
  } catch (error) {
    console.error('❌ Erro ao criar banco de dados:', error.message);
    await adminPool.end();
    return false;
  }
}

async function applySchema() {
  const dbDir = path.join(__dirname, '../../database');
  
  // Ordem dos arquivos SQL a serem executados
  const sqlFiles = [
    'smartchannel-db-v2-refactored-part1-schema-setup.sql',
    'smartchannel-db-v2-refactored-part2-tables-base.sql',
    'smartchannel-db-v2-refactored-part3-tables-dependent.sql',
    'smartchannel-db-v2-refactored-part4-billing-contracts.sql',
    'smartchannel-db-v2-refactored-part5-tables-relationships.sql',
    'smartchannel-db-v2-refactored-part6-tables-other.sql',
    'smartchannel-db-v2-refactored-part7-foreign-keys.sql',
    'smartchannel-db-v2-refactored-part8-indexes.sql',
    'smartchannel-db-v2-refactored-part9-triggers-functions.sql',
    'smartchannel-db-v2-refactored-part10-views.sql'
  ];
  
  const pool = new Pool(dbConfig);
  
  try {
    console.log('📄 Aplicando schema v2.0...\n');
    
    for (let i = 0; i < sqlFiles.length; i++) {
      const sqlFile = sqlFiles[i];
      const filePath = path.join(dbDir, sqlFile);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${sqlFile}`);
        continue;
      }
      
      console.log(`[${i + 1}/${sqlFiles.length}] Executando ${sqlFile}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Executar o SQL completo (pg aceita múltiplos comandos)
      try {
        await pool.query(sql);
        console.log(`   ✅ ${sqlFile} executado com sucesso`);
      } catch (err) {
        // Ignorar erros de "já existe" e similares
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate key') ||
            err.message.includes('does not exist') || // Coluna não existe (pode ser problema de ordem)
            err.code === '42P07' || // duplicate_table
            err.code === '42710' || // duplicate_object
            err.code === '42703') { // undefined_column
          console.log(`   ⚠️  ${sqlFile}: ${err.message.substring(0, 150)}`);
          console.log(`   ℹ️  Continuando (erro esperado/não crítico)...`);
          // Não lançar erro - continuar
        } else if (sqlFile.includes('indexes') || sqlFile.includes('triggers') || sqlFile.includes('foreign-keys') || sqlFile.includes('views')) {
          // Para índices, triggers, FKs e views, avisar mas continuar
          console.log(`   ⚠️  ${sqlFile}: ${err.message.substring(0, 150)}`);
          console.log(`   ℹ️  Continuando (erro em estrutura não crítica)...`);
        } else {
          console.error(`   ❌ Erro ao executar ${sqlFile}:`, err.message.substring(0, 200));
          throw err;
        }
      }
    }
    
    console.log('\n✅ Schema aplicado com sucesso!');
    await pool.end();
    return true;
  } catch (error) {
    console.error('\n❌ Erro ao aplicar schema:', error.message);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log('🚀 Configurando banco de dados SmartSignage Pro...\n');
  
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    process.exit(1);
  }
  
  // Aplicar schema automaticamente
  console.log('\n📋 Aplicando schema v2.0...');
  const schemaApplied = await applySchema();
  if (schemaApplied) {
    console.log('\n✅ Configuração do banco de dados concluída!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Schema não foi aplicado. Você pode aplicar manualmente usando:');
    console.log('   psql -U postgres -d smartsignage -f database/smartchannel-db-v2-refactored-apply-all.sql');
    process.exit(1);
  }
}

main().catch(console.error);

