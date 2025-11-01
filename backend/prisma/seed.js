// Smart Signage Pro v2.0 - Seed de dados correlacionados (PostgreSQL)
// Idempotente: pode rodar múltiplas vezes

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertAdminAndOpsUsers(clientId) {
  const adminEmail = 'admin@smart-signage.com';
  const opsEmail = 'ops@smart-signage.com';
  const adminUsername = 'admin';
  const opsUsername = 'ops';
  // Senha deve ter pelo menos 6 caracteres (mudado de 'admin' para 'admin123')
  const adminHash = await bcrypt.hash('admin123', 12);
  const opsHash = await bcrypt.hash('ops123', 12);

  // Usar executeRaw para criar usuários com username (campo que existe no banco mas não no Prisma schema)
  try {
    // Admin user
    await prisma.$executeRaw`
      INSERT INTO users (username, email, password_hash, name, role, is_active, created_at, updated_at)
      VALUES (${adminUsername}, ${adminEmail}, ${adminHash}, 'Administrator', 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET 
        role = 'admin',
        is_active = true,
        password_hash = ${adminHash},
        updated_at = CURRENT_TIMESTAMP
    `;
    
    // Ops user
    await prisma.$executeRaw`
      INSERT INTO users (username, email, password_hash, name, role, is_active, created_at, updated_at)
      VALUES (${opsUsername}, ${opsEmail}, ${opsHash}, 'Operator', 'operator', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET 
        role = 'operator',
        is_active = true,
        password_hash = ${opsHash},
        updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error('Erro ao criar usuários:', error);
    throw error;
  }
}

async function ensureClient() {
  const name = 'Cliente Padrão';
  const existing = await prisma.client.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.client.create({ data: { name, email: 'cliente@exemplo.com', phone: '+55 11 99999-9999', is_active: true } });
}

async function ensureMedia(clientId) {
  const mediaSpecs = [
    { filename: 'banner1.jpg', original_name: 'banner1.jpg', file_path: '/opt/smart-signage/public/assets/uploads/banner1.jpg', file_type: 'image/jpeg', file_size: 120000, duration: 10000 },
    { filename: 'banner2.jpg', original_name: 'banner2.jpg', file_path: '/opt/smart-signage/public/assets/uploads/banner2.jpg', file_type: 'image/jpeg', file_size: 140000, duration: 10000 },
    { filename: 'video1.mp4', original_name: 'video1.mp4', file_path: '/opt/smart-signage/public/assets/uploads/video1.mp4', file_type: 'video/mp4', file_size: 2048000, duration: 30000 },
    { filename: 'promo.png', original_name: 'promo.png', file_path: '/opt/smart-signage/public/assets/uploads/promo.png', file_type: 'image/png', file_size: 98000, duration: 8000 },
    { filename: 'logo.webp', original_name: 'logo.webp', file_path: '/opt/smart-signage/public/assets/uploads/logo.webp', file_type: 'image/webp', file_size: 56000, duration: 5000 },
  ];

  const medias = [];
  for (const spec of mediaSpecs) {
    const existing = await prisma.media.findFirst({ where: { filename: spec.filename } });
    if (existing) { medias.push(existing); continue; }
    const created = await prisma.media.create({ data: { ...spec, client_id: clientId } });
    medias.push(created);
  }
  return medias;
}

async function ensurePlaylists(clientId, medias) {
  const mainName = 'Playlist Principal';
  const altName = 'Playlist Alternativa';

  let main = await prisma.playlist.findFirst({ where: { name: mainName } });
  if (!main) {
    main = await prisma.playlist.create({ data: { name: mainName, description: 'Loop principal de mídias', client_id: clientId, is_active: true } });
  }

  let alt = await prisma.playlist.findFirst({ where: { name: altName } });
  if (!alt) {
    alt = await prisma.playlist.create({ data: { name: altName, description: 'Loop alternativo', client_id: clientId, is_active: true } });
  }

  // Garantir itens nas playlists (ordem baseada no índice)
  const ensureItem = async (playlistId, mediaId, order, duration) => {
    const exists = await prisma.playlistItem.findFirst({
      where: { playlist_id: playlistId, media_id: mediaId }
    });
    if (!exists) {
      await prisma.playlistItem.create({ data: { playlist_id: playlistId, media_id: mediaId, order_index: order, duration } });
    }
  };

  // Main: 3 mídias
  const firstThree = medias.slice(0, 3);
  for (let i = 0; i < firstThree.length; i++) {
    await ensureItem(main.id, firstThree[i].id, i, firstThree[i].duration || 10000);
  }

  // Alt: 2 mídias
  const others = medias.slice(3, 5);
  for (let i = 0; i < others.length; i++) {
    await ensureItem(alt.id, others[i].id, i, others[i].duration || 10000);
  }

  return { main, alt };
}

async function ensureTotems(clientId, playlistId) {
  const specs = [
    { name: 'Totem Entrada', location: 'Recepção', client_id: clientId },
    { name: 'Totem Sala', location: 'Sala Principal', client_id: clientId },
  ];
  const totems = [];
  for (const spec of specs) {
    const existing = await prisma.totem.findFirst({ where: { name: spec.name } });
    if (existing) { totems.push(existing); continue; }
    const created = await prisma.totem.create({ data: { ...spec, is_active: true } });
    totems.push(created);
  }
  // Não há tabela de atribuição de playlist no schema Prisma atual.
  // Se necessário, este vínculo pode ser representado via Settings/Notification.
  return totems;
}

async function ensureCampaignsAndQRCodes(clientId) {
  // Campanhas
  const campTitle = 'Campanha Verão';
  let campaign = await prisma.campaign.findFirst({ where: { title: campTitle } });
  if (!campaign) {
    campaign = await prisma.campaign.create({ data: { title: campTitle, description: 'Promoções de verão', client_id: clientId, is_active: true } });
  }

  // QR Codes
  const qrContent = 'https://exemplo.com/promo/verao';
  let qrcode;
  try {
    // Model name QRCode vira qRCode no client Prisma
    qrcode = await prisma.qRCode.findFirst({ where: { content: qrContent } });
  } catch (_) {
    // Fallback caso o client exponha como qrCode
    qrcode = await prisma.qrCode?.findFirst?.({ where: { content: qrContent } });
  }
  if (!qrcode) {
    try {
      qrcode = await prisma.qRCode.create({ data: { content: qrContent, campaign_id: campaign.id, is_active: true } });
    } catch (_) {
      if (prisma.qrCode?.create) {
        qrcode = await prisma.qrCode.create({ data: { content: qrContent, campaign_id: campaign.id, is_active: true } });
      }
    }
  }
  return { campaign, qrcode };
}

async function ensureSettingsNotificationsReportsBilling(clientId, userEmail) {
  // Settings
  await prisma.settings.upsert({
    where: { key: 'theme' },
    update: { value: 'light' },
    create: { key: 'theme', value: 'light', description: 'Tema do painel' }
  });
  await prisma.settings.upsert({
    where: { key: 'timezone' },
    update: { value: 'America/Sao_Paulo' },
    create: { key: 'timezone', value: 'America/Sao_Paulo', description: 'Fuso horário do sistema' }
  });

  // Usuário para vincular notificações/auditoria
  const user = await prisma.user.findFirst({ where: { email: userEmail } });

  // Notification
  if (user) {
    const notifExists = await prisma.notification.findFirst({ where: { user_id: user.id, title: 'Boas-vindas' } });
    if (!notifExists) {
      await prisma.notification.create({ data: { title: 'Boas-vindas', message: 'Sua conta foi criada com sucesso.', user_id: user.id, is_read: false } });
    }

    // AuditLog
    const auditExists = await prisma.auditLog.findFirst({ where: { user_id: user.id, action: 'install' } });
    if (!auditExists) {
      await prisma.auditLog.create({ data: { user_id: user.id, action: 'install', entity: 'system', entity_id: null, metadata: 'Instalação inicial concluída' } });
    }
  }

  // SystemLog
  await prisma.systemLog.create({ data: { event_type: 'info', description: 'Seed inicial executado' } }).catch(() => {});

  // Report
  const repExists = await prisma.report.findFirst({ where: { name: 'Resumo Diário' } });
  if (!repExists) {
    await prisma.report.create({ data: { name: 'Resumo Diário', type: 'daily', data: JSON.stringify({ ok: true }) } });
  }

  // Billing
  const billExists = await prisma.billing.findFirst({ where: { client_id: clientId, status: 'paid' } });
  if (!billExists) {
    await prisma.billing.create({ data: { client_id: clientId, amount: 299.9, status: 'paid' } });
  }
}

async function ensureAnalyticsSamples(totems) {
  // Alguns eventos simples de analytics por totem
  for (const t of totems) {
    const exists = await prisma.analytics.findFirst({ where: { totem_id: t.id, event_type: 'heartbeat' } });
    if (!exists) {
      await prisma.analytics.create({ data: { totem_id: t.id, event_type: 'heartbeat', data: JSON.stringify({ cpu: 0.2, mem: 150 }) } });
    }
  }
}

async function main() {
  console.log('🔧 Executando seed de dados...');

  const client = await ensureClient();
  await upsertAdminAndOpsUsers(client.id);
  const medias = await ensureMedia(client.id);
  const { main: mainPlaylist } = await ensurePlaylists(client.id, medias);
  const totems = await ensureTotems(client.id, mainPlaylist.id);
  await ensureCampaignsAndQRCodes(client.id);
  await ensureAnalyticsSamples(totems);
  await ensureSettingsNotificationsReportsBilling(client.id, 'admin@smart-signage.com');

  console.log('✅ Seed concluído com sucesso');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


