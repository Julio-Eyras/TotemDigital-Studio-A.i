/**
 * AlertService - Sistema de Alertas Inteligente
 * 
 * Monitora métricas do sistema e dispara alertas configuráveis
 */

import { getDatabase } from '../config/database';
import { logError, logWarn, logInfo } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface AlertRule {
  id: string;
  name: string;
  type: 'fps_low' | 'totem_offline' | 'failure_rate' | 'disk_space' | 'latency' | 'mqtt_disconnected';
  threshold: number;
  duration?: number; // Duração em minutos antes de alertar
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  channels: Array<'email' | 'slack' | 'webhook' | 'sms'>;
  recipients?: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  type: string;
  severity: string;
  message: string;
  details: Record<string, any>;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
}

export class AlertService {
  private get db() {
    return getDatabase();
  }

  private alertRules: AlertRule[] = [
    {
      id: 'fps_low',
      name: 'FPS Baixo',
      type: 'fps_low',
      threshold: 15,
      duration: 5,
      severity: 'warning',
      enabled: true,
      channels: ['email'],
    },
    {
      id: 'totem_offline',
      name: 'Totem Offline',
      type: 'totem_offline',
      threshold: 5, // minutos
      severity: 'error',
      enabled: true,
      channels: ['email', 'slack'],
    },
    {
      id: 'failure_rate_high',
      name: 'Taxa de Falha Alta',
      type: 'failure_rate',
      threshold: 10, // porcentagem
      duration: 60, // minutos
      severity: 'error',
      enabled: true,
      channels: ['email'],
    },
    {
      id: 'disk_space_critical',
      name: 'Espaço em Disco Crítico',
      type: 'disk_space',
      threshold: 90, // porcentagem
      severity: 'critical',
      enabled: true,
      channels: ['email', 'slack'],
    },
  ];

  /**
   * Verifica todas as regras de alerta
   */
  async checkAllAlerts(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const alert = await this.checkRule(rule);
        if (alert) {
          alerts.push(alert);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
        await logError('Erro ao verificar regra de alerta', e.error, { ruleId: rule.id });
      }
    }

    return alerts;
  }

  /**
   * Verifica uma regra específica
   */
  async checkRule(rule: AlertRule): Promise<Alert | null> {
    switch (rule.type) {
      case 'fps_low':
        return await this.checkFpsLow(rule);
      case 'totem_offline':
        return await this.checkTotemOffline(rule);
      case 'failure_rate':
        return await this.checkFailureRate(rule);
      case 'disk_space':
        return await this.checkDiskSpace(rule);
      case 'latency':
        return await this.checkLatency(rule);
      case 'mqtt_disconnected':
        return await this.checkMqttDisconnected(rule);
      default:
        return null;
    }
  }

  /**
   * Verifica FPS baixo
   */
  private async checkFpsLow(rule: AlertRule): Promise<Alert | null> {
    try {
      // fx_telemetry pode não existir no schema base (SmartDisplayFX)
      const tableExists = await this.db.tableExists('fx_telemetry');
      if (!tableExists) {
        return null;
      }

      const durationMinutes = rule.duration || 5;
      const threshold = rule.threshold;
      
      const lowFpsTotems = await this.db.findMany(`
        SELECT 
          totem_id, 
          COUNT(*)::int as count, 
          AVG(avg_fps)::numeric(10,2) as avg_fps,
          MIN(avg_fps)::numeric(10,2) as min_fps,
          MAX(avg_fps)::numeric(10,2) as max_fps
        FROM fx_telemetry
        WHERE created_at >= NOW() - INTERVAL '${durationMinutes} minutes'
          AND avg_fps IS NOT NULL
          AND avg_fps < $1
        GROUP BY totem_id 
        HAVING COUNT(*) >= 3
        ORDER BY avg_fps ASC
      `, [threshold]);
      
      if (lowFpsTotems.length === 0) {
        return null;
      }
      
      return {
        id: `alert_${Date.now()}_${rule.id}`,
        ruleId: rule.id,
        type: rule.type,
        severity: rule.severity,
        message: `${lowFpsTotems.length} totem(s) com FPS abaixo de ${threshold} nos últimos ${durationMinutes} minutos`,
        details: { 
          totems: lowFpsTotems.map(t => ({
            totem_id: t.totem_id,
            count: t.count,
            avg_fps: parseFloat(t.avg_fps),
            min_fps: parseFloat(t.min_fps),
            max_fps: parseFloat(t.max_fps)
          })), 
          threshold, 
          duration: durationMinutes 
        },
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar FPS baixo', e.error, { ruleId: rule.id });
      return null;
    }
  }

  /**
   * Verifica totens offline
   */
  private async checkTotemOffline(rule: AlertRule): Promise<Alert | null> {
    const thresholdMinutes = rule.threshold;

    const offlineTotems = await this.db.findMany(`
      SELECT 
        totem_id,
        name,
        last_heartbeat,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat))/60 as minutes_offline
      FROM totems
      WHERE is_active = true
        AND (
          last_heartbeat IS NULL 
          OR last_heartbeat < NOW() - INTERVAL '${thresholdMinutes} minutes'
        )
    `);

    if (offlineTotems.length === 0) {
      return null;
    }

    return {
      id: `alert_${Date.now()}_${rule.id}`,
      ruleId: rule.id,
      type: rule.type,
      severity: rule.severity,
      message: `${offlineTotems.length} totem(s) offline há mais de ${thresholdMinutes} minutos`,
      details: {
        totems: offlineTotems.map(t => ({
          id: t.totem_id,
          name: t.name,
          minutesOffline: Math.round(t.minutes_offline),
        })),
      },
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  /**
   * Verifica taxa de falha alta
   */
  private async checkFailureRate(rule: AlertRule): Promise<Alert | null> {
    try {
      const tableExists = await this.db.tableExists('fx_telemetry');
      if (!tableExists) return null;

      const durationMinutes = rule.duration || 60;
      const threshold = rule.threshold;
      
      const stats = await this.db.findFirst(`
        SELECT 
          COUNT(*)::int as total, 
          COUNT(*) FILTER (WHERE status = 'failed' OR status = 'error')::int as failed
        FROM fx_telemetry 
        WHERE created_at >= NOW() - INTERVAL '${durationMinutes} minutes'
      `);
      
      if (!stats || stats.total === 0) {
        return null;
      }
      
      const failureRate = (stats.failed / stats.total) * 100;
      
      if (failureRate < threshold) {
        return null;
      }
      
      return {
        id: `alert_${Date.now()}_${rule.id}`,
        ruleId: rule.id,
        type: rule.type,
        severity: rule.severity,
        message: `Taxa de falha de ${failureRate.toFixed(2)}% nos últimos ${durationMinutes} minutos (threshold: ${threshold}%)`,
        details: { 
          failureRate: Math.round(failureRate * 100) / 100, 
          threshold, 
          total: stats.total, 
          failed: stats.failed, 
          duration: durationMinutes 
        },
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao verificar taxa de falha', e.error, { ruleId: rule.id });
      return null;
    }
  }

  /**
   * Verifica espaço em disco
   */
  private async checkDiskSpace(rule: AlertRule): Promise<Alert | null> {
    const threshold = rule.threshold;

    // Usar função do sistema para obter uso de disco
    const diskUsage = await this.db.findFirst(`
      SELECT 
        pg_database_size(current_database()) as db_size,
        (SELECT setting FROM pg_settings WHERE name = 'data_directory') as data_dir
    `);

    // Calcular porcentagem (simplificado - em produção usar fs.stat)
    // Por enquanto, verificar tamanho do banco
    const dbSizeGB = diskUsage?.db_size ? (diskUsage.db_size / 1024 / 1024 / 1024) : 0;

    // Em produção, implementar verificação real de disco
    // Por enquanto, usar heurística baseada no tamanho do banco
    const estimatedUsage = Math.min(dbSizeGB * 10, 100); // Estimativa

    if (estimatedUsage < threshold) {
      return null;
    }

    return {
      id: `alert_${Date.now()}_${rule.id}`,
      ruleId: rule.id,
      type: rule.type,
      severity: rule.severity,
      message: `Espaço em disco estimado: ${estimatedUsage.toFixed(1)}% (threshold: ${threshold}%)`,
      details: {
        estimatedUsage: Math.round(estimatedUsage),
        threshold,
        dbSizeGB: dbSizeGB.toFixed(2),
      },
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  /**
   * Verifica latência alta
   */
  private async checkLatency(_rule: AlertRule): Promise<Alert | null> {
    // Implementar verificação de latência de queries
    // Por enquanto, retornar null
    return null;
  }

  /**
   * Verifica MQTT desconectado
   */
  private async checkMqttDisconnected(_rule: AlertRule): Promise<Alert | null> {
    // Verificar status do FxMessageBridge
    // Por enquanto, retornar null
    return null;
  }

  /**
   * Envia alerta pelos canais configurados
   */
  async sendAlert(alert: Alert, channels: string[]): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmail(alert);
            break;
          case 'slack':
            await this.sendSlack(alert);
            break;
          case 'webhook':
            await this.sendWebhook(alert);
            break;
          case 'sms':
            await this.sendSMS(alert);
            break;
 
}} catch (error: unknown) {
      const e = normalizeError(error);
        await logError('Erro ao enviar alerta', e.error, { alertId: alert.id, channel });
      }
    }
  }

  /**
   * Envia alerta por email
   */
  private async sendEmail(alert: Alert): Promise<void> {
    try {
      const { EmailService } = await import('./emailService');
      const emailService = new EmailService();
      
      const rule = this.alertRules.find(r => r.id === alert.ruleId);
      
      // Buscar destinatários: primeiro da regra, depois de env vars, depois admins do banco
      let recipients: string[] = rule?.recipients || [];
      
      // Se não houver destinatários na regra, usar variável de ambiente
      if (recipients.length === 0) {
        const envRecipients = process.env.ALERT_EMAIL_RECIPIENTS;
        if (envRecipients) {
          recipients = envRecipients.split(',').map(r => r.trim()).filter(r => r.length > 0);
        }
      }
      
      // Se ainda não houver, buscar admins do banco
      if (recipients.length === 0) {
        try {
          const admins = await this.db.findMany(`
            SELECT email FROM users 
            WHERE role = 'admin' AND is_active = true AND email IS NOT NULL
          `);
          recipients = admins.map((a: any) => a.email).filter((e: string) => e && e.length > 0);} catch (error: unknown) {
      const e = normalizeError(error);
          await logWarn('Erro ao buscar admins para alertas', { error: e.message });
        }
      }
      
      if (recipients.length === 0) {
        await logWarn('Nenhum destinatário configurado para alerta por email', { alertId: alert.id });
        return;
      }

      const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        critical: '🚨'
      }[alert.severity] || '⚠️';

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #333;">${severityEmoji} Alerta: ${alert.message}</h2>
          <p><strong>Tipo:</strong> ${alert.type}</p>
          <p><strong>Severidade:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Data/Hora:</strong> ${new Date(alert.timestamp).toLocaleString('pt-BR')}</p>
          <h3>Detalhes:</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${JSON.stringify(alert.details, null, 2)}</pre>
        </div>
      `;

      const text = `
Alerta: ${alert.message}
Tipo: ${alert.type}
Severidade: ${alert.severity.toUpperCase()}
Data/Hora: ${new Date(alert.timestamp).toLocaleString('pt-BR')}

Detalhes:
${JSON.stringify(alert.details, null, 2)}
      `;

      for (const recipient of recipients) {
        await emailService.sendEmail({
          to: recipient,
          subject: `[SmartSignage] ${alert.severity.toUpperCase()}: ${alert.message}`,
          html,
          text
        });
      }

      await logInfo('Alerta enviado por email', {
        alertId: alert.id, recipients });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao enviar alerta por email', e.error, { alertId: alert.id });
    }
  }

  /**
   * Envia alerta por Slack
   */
  private async sendSlack(alert: Alert): Promise<void> {
    try {
      const axios = (await import('axios')).default;
      const { config } = await import('../config/env');
      
      const alertingCfg = (config as unknown as Record<string, unknown>).alerting as Record<string, unknown> | undefined;
      const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || alertingCfg?.slackWebhookUrl as string | undefined;
      
      if (!slackWebhookUrl) {
        await logWarn('Webhook do Slack não configurado', { alertId: alert.id });
        return;
      }

      const severityColor = {
        info: '#36a64f',
        warning: '#ffa500',
        error: '#ff0000',
        critical: '#8b0000'
      }[alert.severity] || '#ffa500';

      const payload = {
        text: `*Alerta SmartSignage: ${alert.message}*`,
        attachments: [
          {
            color: severityColor,
            fields: [
              { title: 'Tipo', value: alert.type, short: true },
              { title: 'Severidade', value: alert.severity.toUpperCase(), short: true },
              { title: 'Data/Hora', value: new Date(alert.timestamp).toLocaleString('pt-BR'), short: true },
              { title: 'Detalhes', value: '```' + JSON.stringify(alert.details, null, 2) + '```', short: false }
            ],
            footer: 'SmartSignage Pro',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
          }
        ]
      };

      await axios.post(slackWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      await logInfo('Alerta enviado por Slack', {
        alertId: alert.id });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao enviar alerta por Slack', e.error, { alertId: alert.id });
    }
  }

  /**
   * Envia alerta por webhook
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    try {
      const axios = (await import('axios')).default;
      
      // Buscar webhooks configurados do banco
      // Nota: webhooks pode não existir no schema v2 - usar webhook_configs se disponível
      let webhooks: any[] = [];
      try {
        webhooks = await this.db.findMany(`
          SELECT url, secret, is_active as enabled 
          FROM webhook_configs 
          WHERE is_active = true AND events::jsonb @> $1::jsonb
        `, [JSON.stringify(['alerts'])]);} catch (error: unknown) {
// Se webhook_configs não existir ou falhar, tentar webhooks
        try {
          webhooks = await this.db.findMany(`
        SELECT url, secret, enabled 
        FROM webhooks 
        WHERE enabled = true AND channels @> $1::jsonb
      `, [JSON.stringify(['alerts'])]);
} catch (err: unknown) {
          const e = normalizeError(err);
          await logWarn('Tabela de webhooks não encontrada', { error: e.message });
          webhooks = [];
        }
      }

      if (webhooks.length === 0) {
        await logWarn('Nenhum webhook configurado para alertas', { alertId: alert.id });
        return;
      }

      const payload = {
        alert: {
          id: alert.id,
          ruleId: alert.ruleId,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          timestamp: alert.timestamp
        },
        timestamp: new Date().toISOString()
      };

      for (const webhook of webhooks) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          // Adicionar assinatura se secret configurado
          if (webhook.secret) {
            const crypto = await import('crypto');
            const signature = crypto.createHmac('sha256', webhook.secret)
              .update(JSON.stringify(payload))
              .digest('hex');
            headers['X-Webhook-Signature'] = signature;
          }

          await axios.post(webhook.url, payload, {
            headers,
            timeout: 5000
          });

          await logInfo('Alerta enviado por webhook', {
            alertId: alert.id, webhookUrl: webhook.url });} catch (error: unknown) {
      const e = normalizeError(error);
          await logError('Erro ao enviar alerta para webhook', e.error, { 
            alertId: alert.id, 
            webhookUrl: webhook.url 
          });
        }
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao enviar alerta por webhook', e.error, { alertId: alert.id });
    }
  }

  /**
   * Envia alerta por SMS
   */
  private async sendSMS(alert: Alert): Promise<void> {
    try {
      const axios = (await import('axios')).default;
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        await logWarn('Twilio não configurado para envio de SMS', { alertId: alert.id });
        return;
      }

      const rule = this.alertRules.find(r => r.id === alert.ruleId);
      const recipients = rule?.recipients || [];
      
      if (recipients.length === 0) {
        await logWarn('Nenhum destinatário configurado para alerta por SMS', { alertId: alert.id });
        return;
      }

      const message = `[${alert.severity.toUpperCase()}] ${alert.message}\nTipo: ${alert.type}\n${new Date(alert.timestamp).toLocaleString('pt-BR')}`;

      for (const recipient of recipients) {
        try {
          await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            new URLSearchParams({
              From: twilioFromNumber,
              To: recipient,
              Body: message
            }),
            {
              auth: {
                username: twilioAccountSid,
                password: twilioAuthToken
              },
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );

          await logInfo('Alerta enviado por SMS', {
            alertId: alert.id, recipient });} catch (error: unknown) {
      const e = normalizeError(error);
          await logError('Erro ao enviar alerta por SMS', e.error, { alertId: alert.id, recipient });
        }
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao enviar alerta por SMS', e.error, { alertId: alert.id });
    }
  }

  /**
   * Obtém alertas ativos
   */
  async getActiveAlerts(_limit: number = 50): Promise<Alert[]> {
    // Por enquanto, retornar alertas da verificação atual
    // Em produção, armazenar em banco de dados
    return await this.checkAllAlerts();
  }

  /**
   * Reconhece um alerta
   */
  async acknowledgeAlert(alertId: string, userId: number): Promise<void> {
    // TODO: Implementar reconhecimento de alertas
    await logInfo('Alerta reconhecido', { alertId, userId });
  }
}

let alertServiceInstance: AlertService | null = null;

export function getAlertService(): AlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService();
  }
  return alertServiceInstance;
}

