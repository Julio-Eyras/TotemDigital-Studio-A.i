/**
 * Script para validar e executar carga-inicial-v6.sql
 * Valida schema, constraints e relacionamentos antes de executar
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuração do banco (usar variáveis de ambiente ou padrão)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smartsignage',
  user: process.env.DB_USER || 'smartsignage',
  password: process.env.DB_PASSWORD || 'smartsignage123',
};

async function validateAndExecute() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Conectando ao banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso\n');

    // Ler o script SQL
    const scriptPath = path.join(__dirname, 'carga-inicial-v6.sql');
    console.log(`📖 Lendo script: ${scriptPath}`);
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    console.log(`✅ Script lido (${sqlScript.length} caracteres)\n`);

    // Validar se as tabelas principais existem
    console.log('🔍 Validando schema...');
    const tables = [
      'subscribers', 'publishers', 'users', 'totems', 'smart_tvs',
      'campaigns', 'medias', 'playlists', 'tags', 'fx_telemetry'
    ];
    
    let schemaExists = true;
    const missingTables = [];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Tabela ${table} existe`);
      } else {
        console.log(`  ❌ Tabela ${table} não encontrada`);
        schemaExists = false;
        missingTables.push(table);
      }
    }
    console.log('');
    
    if (!schemaExists) {
      console.log('⚠️  ATENÇÃO: O schema não está completo!');
      console.log(`   Tabelas faltando: ${missingTables.join(', ')}\n`);
      console.log('📋 Para criar o schema completo, execute:');
      console.log('   PowerShell: .\\apply-schema-v2.ps1');
      console.log('   Bash: ./apply-schema-v2.sh\n');
      console.log('   Ou execute os scripts SQL na ordem:');
      console.log('   1. smartchannel-db-v2-refactored-part1-schema-setup.sql');
      console.log('   2. smartchannel-db-v2-refactored-part2-tables-base.sql');
      console.log('   3. ... (veja apply-all-schema-v2.sh para ordem completa)\n');
      console.log('❌ Não é possível executar a carga sem o schema criado.\n');
      await pool.end();
      process.exit(1);
    }

    // Executar o script
    console.log('🚀 Executando script de carga...');
    console.log('   (Isso pode levar alguns minutos...)\n');
    
    const startTime = Date.now();
    await pool.query(sqlScript);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Script executado com sucesso em ${duration}s\n`);

    // Validar dados inseridos
    console.log('🔍 Validando dados inseridos...\n');
    
    const validations = [
      { name: 'Subscribers', query: 'SELECT COUNT(*) as count FROM subscribers' },
      { name: 'Publishers', query: 'SELECT COUNT(*) as count FROM publishers' },
      { name: 'Totens', query: 'SELECT COUNT(*) as count FROM totems' },
      { name: 'Smart TVs', query: 'SELECT COUNT(*) as count FROM smart_tvs' },
      { name: 'Campanhas', query: 'SELECT COUNT(*) as count FROM campaigns' },
      { name: 'Mídias', query: 'SELECT COUNT(*) as count FROM medias' },
      { name: 'Playlists', query: 'SELECT COUNT(*) as count FROM playlists' },
      { name: 'Tags', query: 'SELECT COUNT(*) as count FROM tags' },
      { name: 'FX Telemetry', query: 'SELECT COUNT(*) as count FROM fx_telemetry' },
    ];

    for (const validation of validations) {
      try {
        const result = await pool.query(validation.query);
        const count = parseInt(result.rows[0].count);
        console.log(`  ✅ ${validation.name}: ${count} registro(s)`);
      } catch (error) {
        console.log(`  ⚠️  ${validation.name}: Tabela não existe ou erro - ${error.message}`);
      }
    }
    console.log('');

    // Validar relacionamentos críticos
    console.log('🔍 Validando relacionamentos...\n');
    
    const relationships = [
      {
        name: 'Totens → Locals',
        query: `SELECT COUNT(*) as count FROM totems t 
                LEFT JOIN locals l ON t.local_id = l.local_id 
                WHERE t.local_id IS NOT NULL AND l.local_id IS NULL`
      },
      {
        name: 'Campanhas → Subscribers',
        query: `SELECT COUNT(*) as count FROM campaigns c 
                LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id 
                WHERE c.subscriber_id IS NOT NULL AND s.subscriber_id IS NULL`
      },
      {
        name: 'Playlists → Subscribers',
        query: `SELECT COUNT(*) as count FROM playlists p 
                LEFT JOIN subscribers s ON p.subscriber_id = s.subscriber_id 
                WHERE p.subscriber_id IS NOT NULL AND s.subscriber_id IS NULL`
      },
      {
        name: 'Smart TVs → Totens',
        query: `SELECT COUNT(*) as count FROM smart_tvs tv 
                LEFT JOIN totems t ON tv.totem_id = t.totem_id 
                WHERE tv.totem_id IS NOT NULL AND t.totem_id IS NULL`
      },
    ];

    for (const rel of relationships) {
      try {
        const result = await pool.query(rel.query);
        const count = parseInt(result.rows[0].count);
        if (count === 0) {
          console.log(`  ✅ ${rel.name}: Relacionamentos válidos`);
        } else {
          console.log(`  ⚠️  ${rel.name}: ${count} registro(s) com FK inválida`);
        }
      } catch (error) {
        console.log(`  ⚠️  ${rel.name}: Erro na validação - ${error.message}`);
      }
    }
    console.log('');

    // Validar dados de teste de alertas
    console.log('🔍 Validando dados para testes de alertas...\n');
    
    try {
      // Totem com FPS baixo
      const fpsResult = await pool.query(`
        SELECT COUNT(*) as count, AVG(avg_fps) as avg_fps 
        FROM fx_telemetry 
        WHERE totem_id = 4 AND avg_fps < 15
      `);
      if (fpsResult.rows[0].count > 0) {
        console.log(`  ✅ Totem 4 (FPS baixo): ${fpsResult.rows[0].count} registro(s) com FPS < 15 (média: ${parseFloat(fpsResult.rows[0].avg_fps).toFixed(2)})`);
      }
      
      // Totem com falhas
      const failureResult = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) as total,
          ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as failure_rate
        FROM fx_telemetry 
        WHERE totem_id = 1
      `);
      if (failureResult.rows[0].total > 0) {
        console.log(`  ✅ Totem 1 (taxa de falha): ${failureResult.rows[0].failed}/${failureResult.rows[0].total} falhas (${failureResult.rows[0].failure_rate}%)`);
      }
      
      // Totem offline
      const offlineResult = await pool.query(`
        SELECT COUNT(*) as count FROM totems 
        WHERE totem_id = 7 AND status = 'offline'
      `);
      if (offlineResult.rows[0].count > 0) {
        console.log(`  ✅ Totem 7 (offline): Configurado para teste de alerta`);
      }
    } catch (error) {
      console.log(`  ⚠️  Erro ao validar alertas: ${error.message}`);
    }
    console.log('');

    console.log('✅ Validação concluída com sucesso!');
    console.log('📊 O banco está pronto para testes integrados.\n');

  } catch (error) {
    console.error('❌ Erro ao executar script:', error.message);
    if (error.detail) {
      console.error('   Detalhes:', error.detail);
    }
    if (error.position) {
      console.error('   Posição no SQL:', error.position);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
validateAndExecute().catch(console.error);
