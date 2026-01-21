/**
 * Script para verificar schema e executar carga-inicial-v6.sql
 * Se o schema não existir, informa como criá-lo
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smartsignage',
  user: process.env.DB_USER || 'smartsignage',
  password: process.env.DB_PASSWORD || 'smartsignage123',
};

async function main() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Verificando conexão com banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao banco:', dbConfig.database, '\n');

    // Verificar se schema existe
    console.log('🔍 Verificando se o schema está criado...\n');
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscribers', 'publishers', 'users', 'totems', 'campaigns')
    `;
    
    const result = await pool.query(checkQuery);
    const tableCount = parseInt(result.rows[0].count);
    
    if (tableCount < 5) {
      console.log('❌ Schema não está completo!');
      console.log(`   Encontradas apenas ${tableCount} das 5 tabelas principais.\n`);
      console.log('📋 ANTES de executar a carga v6, você precisa criar o schema:\n');
      console.log('   Opção 1 (PowerShell):');
      console.log('     cd database');
      console.log('     powershell -ExecutionPolicy Bypass -File apply-schema-v2.ps1\n');
      console.log('   Opção 2 (Node.js - se tiver os módulos):');
      console.log('     Execute os scripts SQL na ordem correta\n');
      console.log('   Opção 3 (Manual):');
      console.log('     Execute os arquivos SQL na ordem:');
      console.log('     1. smartchannel-db-v2-refactored-part1-schema-setup.sql');
      console.log('     2. smartchannel-db-v2-refactored-part2-tables-base.sql');
      console.log('     3. smartchannel-db-v2-refactored-part3-tables-dependent.sql');
      console.log('     4. smartchannel-db-v2-refactored-part4-billing-contracts.sql');
      console.log('     5. smartchannel-db-v2-refactored-part5-tables-relationships.sql');
      console.log('     6. smartchannel-db-v2-refactored-part6-tables-other.sql');
      console.log('     7. seeds-default-settings.sql');
      console.log('     8. smartchannel-db-v2-refactored-part7-foreign-keys.sql');
      console.log('     9. smartchannel-db-v2-refactored-part8-indexes.sql');
      console.log('     10. smartchannel-db-v2-refactored-part9-triggers-functions.sql');
      console.log('     11. smartchannel-db-v2-refactored-part10-views.sql');
      console.log('     12. smartchannel-db-v2-refactored-part11-playlist-mix.sql');
      console.log('     13. smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql');
      console.log('     14. smartchannel-db-v2-refactored-part13-dispatcher-views.sql');
      console.log('     15. seeds-playlist-mix.sql\n');
      console.log('   Depois execute: node validate-v6.js\n');
      await pool.end();
      process.exit(1);
    }

    console.log('✅ Schema encontrado! Todas as tabelas principais existem.\n');
    console.log('🚀 Executando carga-inicial-v6.sql...\n');
    
    const scriptPath = path.join(__dirname, 'carga-inicial-v6.sql');
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    
    const startTime = Date.now();
    await pool.query(sqlScript);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Carga executada com sucesso em ${duration}s\n`);
    
    // Validar dados
    console.log('🔍 Validando dados inseridos...\n');
    
    const validations = [
      { name: 'Subscribers', query: 'SELECT COUNT(*) as count FROM subscribers' },
      { name: 'Publishers', query: 'SELECT COUNT(*) as count FROM publishers' },
      { name: 'Totens', query: 'SELECT COUNT(*) as count FROM totems' },
      { name: 'Smart TVs', query: 'SELECT COUNT(*) as count FROM smart_tvs' },
      { name: 'Campanhas', query: 'SELECT COUNT(*) as count FROM campaigns WHERE is_active = true' },
      { name: 'Mídias', query: 'SELECT COUNT(*) as count FROM medias WHERE is_active = true' },
      { name: 'Playlists', query: 'SELECT COUNT(*) as count FROM playlists WHERE is_active = true' },
    ];

    for (const v of validations) {
      try {
        const r = await pool.query(v.query);
        console.log(`  ✅ ${v.name}: ${r.rows[0].count} registro(s)`);
      } catch (e) {
        console.log(`  ⚠️  ${v.name}: ${e.message}`);
      }
    }
    
    // Verificar dados de teste
    console.log('\n🔍 Verificando dados para testes...\n');
    
    try {
      const tagsResult = await pool.query('SELECT COUNT(*) as count FROM tags');
      console.log(`  ✅ Tags: ${tagsResult.rows[0].count} registro(s) com metadata JSONB`);
      
      const fxResult = await pool.query('SELECT COUNT(*) as count FROM fx_telemetry');
      console.log(`  ✅ FX Telemetry: ${fxResult.rows[0].count} registro(s) para testes de alertas`);
      
      const fpsLow = await pool.query(`
        SELECT COUNT(*) as count FROM fx_telemetry 
        WHERE totem_id = 4 AND avg_fps < 15
      `);
      console.log(`  ✅ Totem 4 (FPS baixo): ${fpsLow.rows[0].count} registro(s) com FPS < 15`);
      
      const failures = await pool.query(`
        SELECT COUNT(*) FILTER (WHERE status = 'failed') as failed, COUNT(*) as total
        FROM fx_telemetry WHERE totem_id = 1
      `);
      if (failures.rows[0].total > 0) {
        const rate = ((failures.rows[0].failed / failures.rows[0].total) * 100).toFixed(1);
        console.log(`  ✅ Totem 1 (falhas): ${failures.rows[0].failed}/${failures.rows[0].total} (${rate}%)`);
      }
    } catch (e) {
      console.log(`  ⚠️  Erro: ${e.message}`);
    }
    
    console.log('\n✅ Validação completa! Banco pronto para testes.\n');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Verifique se o PostgreSQL está rodando e as credenciais estão corretas.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
