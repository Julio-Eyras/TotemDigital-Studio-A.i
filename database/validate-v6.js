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
      'campaigns', 'campaign_medias', 'medias', 'playlists', 'tags', 'fx_telemetry'
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

    // Executar o script (omitir se seeds já foram aplicados pelo instalador dinâmico)
    if (process.env.VALIDATE_V6_SKIP_LOAD === 'true' || process.env.VALIDATE_V6_SKIP_LOAD === '1') {
      console.log('ℹ️  VALIDATE_V6_SKIP_LOAD: pulando execução de carga-inicial-v6.sql (apenas validação)\n');
    } else {
      console.log('🚀 Executando script de carga...');
      console.log('   (Isso pode levar alguns minutos...)\n');

      const startTime = Date.now();
      await pool.query(sqlScript);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`✅ Script executado com sucesso em ${duration}s\n`);
    }

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
      {
        name: 'Campaign medias → Campanhas / Mídias',
        query: `SELECT COUNT(*) as count FROM campaign_medias cm
                LEFT JOIN campaigns c ON cm.campaign_id = c.campaign_id
                LEFT JOIN medias m ON cm.media_id = m.media_id
                WHERE c.campaign_id IS NULL OR m.media_id IS NULL`
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
          ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / NULLIF(COUNT(*), 0), 2) as failure_rate
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

    // Validação módulo financeiro (billing moderno)
    console.log('🔍 Validando módulo financeiro...\n');
    let financialOk = true;

    const financialTables = ['subscriber_billing', 'publisher_billing', 'subscriber_contracts'];
    for (const table of financialTables) {
      const exists = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [table]
      );
      if (exists.rows[0].exists) {
        console.log(`  ✅ Tabela ${table} existe`);
      } else {
        console.log(`  ❌ Tabela ${table} não encontrada`);
        financialOk = false;
      }
    }

    const constraintChecks = [
      {
        name: 'subscriber_billing.payment_status inclui overdue',
        query: `
          SELECT pg_get_constraintdef(oid) AS def
          FROM pg_constraint
          WHERE conname = 'chk_subscriber_billing_payment_status'
        `,
        mustInclude: 'overdue',
      },
      {
        name: 'publisher_billing.payment_status inclui overdue',
        query: `
          SELECT pg_get_constraintdef(oid) AS def
          FROM pg_constraint
          WHERE conname = 'chk_publisher_billing_payment_status'
        `,
        mustInclude: 'overdue',
      },
    ];

    for (const check of constraintChecks) {
      try {
        const result = await pool.query(check.query);
        const def = result.rows[0]?.def || '';
        if (def.includes(check.mustInclude)) {
          console.log(`  ✅ ${check.name}`);
        } else {
          console.log(`  ❌ ${check.name} — execute smartchannel-db-v2-compat-publisher-billing-overdue.sql`);
          financialOk = false;
        }
      } catch (error) {
        console.log(`  ⚠️  ${check.name}: ${error.message}`);
        financialOk = false;
      }
    }

    const columnChecks = [
      { table: 'subscriber_billing', column: 'contract_id' },
      { table: 'subscriber_billing', column: 'period_start' },
      { table: 'subscriber_billing', column: 'period_end' },
      { table: 'subscriber_contracts', column: 'billing_interval' },
      { table: 'publisher_contracts', column: 'billing_interval' },
      { table: 'publisher_billing', column: 'direction' },
      { table: 'publisher_billing', column: 'contract_id' },
      { table: 'publisher_billing', column: 'period_start' },
      { table: 'publisher_billing', column: 'period_end' },
      { table: 'plans', column: 'price_four_month' },
      { table: 'plans', column: 'price_semester' },
    ];
    for (const col of columnChecks) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        )`,
        [col.table, col.column]
      );
      if (result.rows[0].exists) {
        console.log(`  ✅ Coluna ${col.table}.${col.column}`);
      } else {
        console.log(`  ❌ Coluna ${col.table}.${col.column} ausente`);
        financialOk = false;
      }
    }

    try {
      const overdueSub = await pool.query(`
        SELECT COUNT(*)::int AS c FROM subscriber_billing WHERE payment_status = 'overdue'
      `);
      const overduePub = await pool.query(`
        SELECT COUNT(*)::int AS c FROM publisher_billing WHERE payment_status = 'overdue'
      `);
      const subOverdue = overdueSub.rows[0].c;
      const pubOverdue = overduePub.rows[0].c;
      console.log(
        `  ℹ️  Faturas overdue: anunciantes=${subOverdue}, exibidor=${pubOverdue}`
      );
      if (process.env.VALIDATE_V6_SKIP_LOAD === 'true' || process.env.VALIDATE_V6_SKIP_LOAD === '1') {
        const subTotal = await pool.query(`SELECT COUNT(*)::int AS c FROM subscribers`);
        if (subTotal.rows[0].c >= 3) {
          if (subOverdue >= 1 && pubOverdue >= 1) {
            console.log('  ✅ Seeds demo financeiros (semáforo vermelho testável)');
          } else {
            console.log(
              '  ⚠️  Seeds demo financeiros incompletos — execute: bash scripts/install-smartsignage.sh --seeds-only --load-seeds'
            );
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Contagem overdue: ${error.message}`);
    }

    if (!financialOk) {
      console.log('\n⚠️  Módulo financeiro incompleto — aplique apply-schema-v2.sh ou o compat overdue.\n');
    } else {
      console.log('\n  ✅ Módulo financeiro: schema OK\n');
    }

    console.log('🔍 Validando perfil Studio (installation.profile + owner publisher)...\n');
    let studioOk = true;

    try {
      const colOwner = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'is_system_owner'
        )
      `);
      if (colOwner.rows[0].exists) {
        console.log('  ✅ Coluna publishers.is_system_owner');
      } else {
        console.log('  ❌ Coluna publishers.is_system_owner ausente — execute apply-schema-v2.sh');
        studioOk = false;
      }

      const profileRow = await pool.query(`
        SELECT setting_value FROM system_settings WHERE setting_key = 'installation.profile' LIMIT 1
      `);
      const profile = profileRow.rows[0]?.setting_value;
      if (profile === 'single_publisher' || profile === 'multi_agency') {
        console.log(`  ✅ installation.profile = ${profile}`);
      } else if (!profile) {
        console.log('  ⚠️  installation.profile não definido (opcional em upgrades Pro)');
      } else {
        console.log(`  ❌ installation.profile inválido: ${profile}`);
        studioOk = false;
      }

      const owners = await pool.query(`
        SELECT COUNT(*)::int AS c FROM publishers WHERE is_system_owner = true AND is_active = true
      `);
      const ownerCount = owners.rows[0].c;
      if (profile === 'single_publisher') {
        if (ownerCount === 1) {
          console.log('  ✅ Exatamente um publisher is_system_owner ativo');
        } else {
          console.log(`  ❌ Perfil single_publisher requer 1 owner; encontrados: ${ownerCount}`);
          studioOk = false;
        }
      } else if (ownerCount > 1) {
        console.log(`  ⚠️  Mais de um is_system_owner (${ownerCount}) — recomendado só em mono`);
      }

      const adminPub = await pool.query(`
        SELECT u.username, u.publisher_id
        FROM users u
        WHERE u.role IN ('admin', 'owner_system', 'admin_sql')
          AND u.is_active = true
        ORDER BY u.id ASC
        LIMIT 1
      `);
      if (adminPub.rows[0]?.publisher_id != null) {
        console.log(
          `  ✅ Admin com publisher_id=${adminPub.rows[0].publisher_id} (${adminPub.rows[0].username})`
        );
      } else if (profile === 'single_publisher') {
        console.log('  ⚠️  Admin sem publisher_id — repasse exibidor pode falhar na UI');
      }
    } catch (error) {
      console.log(`  ⚠️  Validação Studio: ${error.message}`);
      studioOk = false;
    }

    if (!studioOk) {
      console.log('\n⚠️  Perfil Studio incompleto — reaplique schema/seed ou instalador compacto.\n');
    } else {
      console.log('\n  ✅ Perfil Studio: validações OK\n');
    }

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
