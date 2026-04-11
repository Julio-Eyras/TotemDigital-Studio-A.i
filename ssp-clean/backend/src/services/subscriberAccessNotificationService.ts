/**
 * Subscriber Access Notification Service - Smart Signage v2.0
 * Serviço para verificar e notificar sobre acessos subscriber → publisher expirando
 */

import { getDatabase } from '../config/database';
import { logError, logInfo } from '../utils/loggerHelper';
import { NotificationService } from './notificationService';
import { emailService } from './emailService';

// Configuração de períodos de aviso (em dias)
export const NOTIFICATION_PERIODS = [7, 15, 30] as const;
export type NotificationPeriod = typeof NOTIFICATION_PERIODS[number];

export class SubscriberAccessNotificationService {
  private get db() {
    return getDatabase();
  }

  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Verifica acessos expirando em X dias e envia notificações
   * @param daysBeforeExpiry Número de dias antes da expiração para notificar
   */
  async checkAndNotifyExpiringAccess(daysBeforeExpiry: number): Promise<{
    checked: number;
    notified: number;
    errors: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + daysBeforeExpiry);

      // Buscar acessos que expiram em até X dias e ainda não foram notificados
      const expiringAccess = await this.db.findMany(`
        SELECT 
          spa.access_id,
          spa.subscriber_id,
          s.name as subscriber_name,
          spa.publisher_id,
          p.name as publisher_name,
          spa.expires_at,
          spa.contract_id,
          sc.contract_number,
          spa.plan_id,
          pl.name as plan_name,
          spa.access_type,
          u.id as user_id,
          u.email as user_email
        FROM subscriber_publisher_access spa
        JOIN subscribers s ON spa.subscriber_id = s.subscriber_id
        JOIN publishers p ON spa.publisher_id = p.publisher_id
        LEFT JOIN subscriber_contracts sc ON spa.contract_id = sc.contract_id
        LEFT JOIN plans pl ON spa.plan_id = pl.plan_id
        LEFT JOIN users u ON u.subscriber_id = spa.subscriber_id AND u.role = 'subscriber'
        WHERE spa.is_active = true
          AND spa.expires_at IS NOT NULL
          AND spa.expires_at > CURRENT_TIMESTAMP
          AND spa.expires_at <= $1
          AND (spa.metadata->>'expiry_notified_30d' IS NULL OR spa.metadata->>'expiry_notified_30d' = 'false')
        ORDER BY spa.expires_at ASC
      `, [cutoffDate.toISOString()]);

      let notified = 0;
      let errors = 0;

      for (const access of expiringAccess) {
        try {
          const daysUntilExpiry = Math.ceil(
            (new Date(access.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          // Enviar notificação para usuários do subscriber
          if (access.user_id) {
            await this.notificationService.sendNotification({
              type: 'warning',
              title: 'Acesso a Publisher Expirando',
              message: `Seu acesso ao publisher "${access.publisher_name}" expira em ${daysUntilExpiry} dia(s). Data de expiração: ${new Date(access.expires_at).toLocaleDateString('pt-BR')}. Entre em contato para renovar.`,
              userId: access.user_id,
              clientId: access.subscriber_id,
              data: {
                accessId: access.access_id,
                subscriberId: access.subscriber_id,
                publisherId: access.publisher_id,
                publisherName: access.publisher_name,
                expiresAt: access.expires_at,
                daysUntilExpiry,
                contractId: access.contract_id,
                contractNumber: access.contract_number,
                planId: access.plan_id,
                planName: access.plan_name,
                accessType: access.access_type,
              },
            });
          }

          // Também enviar notificação para todos os usuários do subscriber (via clientId)
          await this.notificationService.sendNotification({
            type: 'warning',
            title: 'Acesso a Publisher Expirando',
            message: `O acesso do subscriber "${access.subscriber_name}" ao publisher "${access.publisher_name}" expira em ${daysUntilExpiry} dia(s).`,
            clientId: access.subscriber_id,
            data: {
              accessId: access.access_id,
              subscriberId: access.subscriber_id,
              subscriberName: access.subscriber_name,
              publisherId: access.publisher_id,
              publisherName: access.publisher_name,
              expiresAt: access.expires_at,
              daysUntilExpiry,
            },
          });

          // Marcar como notificado no metadata
          await this.db.executeRaw(`
            UPDATE subscriber_publisher_access
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'expiry_notified_30d', true,
              'expiry_notified_at_30d', $1
            )
            WHERE access_id = $2
          `, [new Date().toISOString(), access.access_id]);

          notified++;
        } catch (error: any) {
          await logError('Erro ao enviar notificação de acesso expirando', error, {
            accessId: access.access_id,
            subscriberId: access.subscriber_id,
            publisherId: access.publisher_id,
          });
          errors++;
        }
      }

      await logInfo('Verificação de acessos expirando concluída', {
        checked: expiringAccess.length,
        notified,
        errors,
        daysBeforeExpiry,
      });

      return {
        checked: expiringAccess.length,
        notified,
        errors,
      };
    } catch (error: any) {
      await logError('Erro ao verificar acessos expirando', error);
      throw error;
    }
  }

  /**
   * Verifica acessos expirando em múltiplos períodos e envia notificações
   * @param periods Array de períodos em dias (ex: [7, 15, 30])
   */
  async checkAndNotifyAllPeriods(periods: number[] = [7, 15, 30]): Promise<{
    totalChecked: number;
    totalNotified: number;
    totalErrors: number;
    byPeriod: Record<number, { checked: number; notified: number; errors: number }>;
  }> {
    const results: Record<number, { checked: number; notified: number; errors: number }> = {};
    let totalChecked = 0;
    let totalNotified = 0;
    let totalErrors = 0;

    for (const period of periods) {
      try {
        const result = await this.checkAndNotifyExpiringAccess(period);
        results[period] = result;
        totalChecked += result.checked;
        totalNotified += result.notified;
        totalErrors += result.errors;
      } catch (error: any) {
        await logError(`Erro ao verificar período de ${period} dias`, error);
        results[period] = { checked: 0, notified: 0, errors: 1 };
        totalErrors++;
      }
    }

    return {
      totalChecked,
      totalNotified,
      totalErrors,
      byPeriod: results,
    };
  }

  /**
   * Verifica acessos já expirados e envia notificações
   */
  async checkAndNotifyExpiredAccess(): Promise<{
    checked: number;
    notified: number;
    errors: number;
  }> {
    try {
      // Buscar acessos expirados recentemente (últimas 24h) que ainda não foram notificados
      const expiredAccess = await this.db.findMany(`
        SELECT 
          spa.access_id,
          spa.subscriber_id,
          s.name as subscriber_name,
          spa.publisher_id,
          p.name as publisher_name,
          spa.expires_at,
          spa.contract_id,
          sc.contract_number,
          spa.plan_id,
          pl.name as plan_name,
          spa.access_type,
          u.id as user_id
        FROM subscriber_publisher_access spa
        JOIN subscribers s ON spa.subscriber_id = s.subscriber_id
        JOIN publishers p ON spa.publisher_id = p.publisher_id
        LEFT JOIN subscriber_contracts sc ON spa.contract_id = sc.contract_id
        LEFT JOIN plans pl ON spa.plan_id = pl.plan_id
        LEFT JOIN users u ON u.subscriber_id = spa.subscriber_id AND u.role = 'subscriber'
        WHERE spa.is_active = true
          AND spa.expires_at IS NOT NULL
          AND spa.expires_at <= CURRENT_TIMESTAMP
          AND spa.expires_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND (spa.metadata->>'expiry_notified_expired' IS NULL OR spa.metadata->>'expiry_notified_expired' = 'false')
        ORDER BY spa.expires_at DESC
      `);

      let notified = 0;
      let errors = 0;

      for (const access of expiredAccess) {
        try {
          const expiryDate = new Date(access.expires_at).toLocaleDateString('pt-BR');
          const notificationTitle = 'Acesso a Publisher Expirado';
          const notificationMessage = `Seu acesso ao publisher "${access.publisher_name}" expirou em ${expiryDate}. Entre em contato para renovar.`;

          // Enviar notificação para usuários do subscriber
          if (access.user_id) {
            await this.notificationService.sendNotification({
              type: 'error',
              title: notificationTitle,
              message: notificationMessage,
              userId: access.user_id,
              clientId: access.subscriber_id,
              data: {
                accessId: access.access_id,
                subscriberId: access.subscriber_id,
                publisherId: access.publisher_id,
                publisherName: access.publisher_name,
                expiresAt: access.expires_at,
                contractId: access.contract_id,
                contractNumber: access.contract_number,
              },
            });
          }

          // Também enviar notificação para todos os usuários do subscriber
          await this.notificationService.sendNotification({
            type: 'error',
            title: notificationTitle,
            message: `O acesso do subscriber "${access.subscriber_name}" ao publisher "${access.publisher_name}" expirou.`,
            clientId: access.subscriber_id,
            data: {
              accessId: access.access_id,
              subscriberId: access.subscriber_id,
              subscriberName: access.subscriber_name,
              publisherId: access.publisher_id,
              publisherName: access.publisher_name,
              expiresAt: access.expires_at,
            },
          });

          // Enviar email se configurado
          const emailRecipients: string[] = [];
          if (access.user_email) {
            emailRecipients.push(access.user_email);
          }
          if (access.subscriber_email && !emailRecipients.includes(access.subscriber_email)) {
            emailRecipients.push(access.subscriber_email);
          }

          if (emailRecipients.length > 0) {
            try {
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #d32f2f;">❌ Acesso Expirado</h2>
                  <p>Olá ${access.user_name || access.subscriber_name},</p>
                  <p>Este é um aviso automático sobre o acesso do seu subscriber ao publisher.</p>
                  <div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Publisher:</strong> ${access.publisher_name}</p>
                    <p style="margin: 5px 0;"><strong>Subscriber:</strong> ${access.subscriber_name}</p>
                    <p style="margin: 5px 0;"><strong>Data de expiração:</strong> ${expiryDate}</p>
                    ${access.contract_number ? `<p style="margin: 5px 0;"><strong>Contrato:</strong> ${access.contract_number}</p>` : ''}
                    ${access.plan_name ? `<p style="margin: 5px 0;"><strong>Plano:</strong> ${access.plan_name}</p>` : ''}
                  </div>
                  <p><strong>O acesso expirou e precisa ser renovado para continuar usando este publisher.</strong></p>
                  <p>Por favor, entre em contato imediatamente para renovar o acesso.</p>
                  <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    Esta é uma mensagem automática do sistema Smart Signage.
                  </p>
                </div>
              `;

              const emailText = `
ACESSO EXPIRADO

Publisher: ${access.publisher_name}
Subscriber: ${access.subscriber_name}
Data de expiração: ${expiryDate}
${access.contract_number ? `Contrato: ${access.contract_number}` : ''}
${access.plan_name ? `Plano: ${access.plan_name}` : ''}

O acesso expirou e precisa ser renovado para continuar usando este publisher.
Por favor, entre em contato imediatamente para renovar o acesso.
              `;

              await emailService.sendEmail({
                to: emailRecipients,
                subject: `[Smart Signage] ${notificationTitle}`,
                html: emailHtml,
                text: emailText,
              });
            } catch (emailError: any) {
              await logError('Erro ao enviar email de notificação de acesso expirado', emailError, {
                accessId: access.access_id,
                recipients: emailRecipients,
              });
              // Não falhar a notificação se o email falhar
            }
          }

          // Marcar como notificado
          await this.db.executeRaw(`
            UPDATE subscriber_publisher_access
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'expiry_notified_expired', true,
              'expiry_notified_at_expired', $1
            )
            WHERE access_id = $2
          `, [new Date().toISOString(), access.access_id]);

          notified++;
        } catch (error: any) {
          await logError('Erro ao enviar notificação de acesso expirado', error, {
            accessId: access.access_id,
            subscriberId: access.subscriber_id,
            publisherId: access.publisher_id,
          });
          errors++;
        }
      }

      await logInfo('Verificação de acessos expirados concluída', {
        checked: expiredAccess.length,
        notified,
        errors,
      });

      return {
        checked: expiredAccess.length,
        notified,
        errors,
      };
    } catch (error: any) {
      await logError('Erro ao verificar acessos expirados', error);
      throw error;
    }
  }
}

// Singleton instance
let subscriberAccessNotificationServiceInstance: SubscriberAccessNotificationService | null = null;

export function getSubscriberAccessNotificationServiceInstance(): SubscriberAccessNotificationService {
  if (!subscriberAccessNotificationServiceInstance) {
    subscriberAccessNotificationServiceInstance = new SubscriberAccessNotificationService();
  }
  return subscriberAccessNotificationServiceInstance;
}

