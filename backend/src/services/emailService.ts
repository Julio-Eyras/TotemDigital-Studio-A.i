/**
 * Email Service - Smart Signage v2.1
 * Serviço de envio de emails usando Nodemailer
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled: boolean;
  private defaultFrom: string;

  constructor() {
    this.isEnabled = process.env.EMAIL_ENABLED !== 'false';
    this.defaultFrom = process.env.SMTP_FROM || 'Smart Signage <noreply@smartsignage.com>';
    
    if (this.isEnabled) {
      this.initializeTransporter();
    }
  }

  /**
   * Inicializa transporter do Nodemailer
   */
  private initializeTransporter(): void {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        }
      };

      // Verificar se credenciais estão configuradas
      if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
        console.warn('⚠️ SMTP não configurado. Email desabilitado.');
        this.isEnabled = false;
        return;
      }

      this.transporter = nodemailer.createTransport(smtpConfig);

      // Verificar conexão
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Erro ao verificar conexão SMTP:', error.message);
          this.isEnabled = false;
        } else {
          console.log('✅ Email Service configurado e pronto');
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao inicializar Email Service:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Envia email
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.isEnabled || !this.transporter) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 [DEV MODE] Email não enviado (SMTP desabilitado):');
          console.log('   Para:', options.to);
          console.log('   Assunto:', options.subject);
          console.log('   Conteúdo:', options.text || options.html?.substring(0, 100) + '...');
        }
        return {
          success: false,
          error: 'Email Service não está habilitado ou configurado'
        };
      }

      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email enviado: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia email de recuperação de senha
   */
  async sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<{ success: boolean; error?: string }> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

      const template = this.getPasswordResetTemplate(username, resetUrl, resetToken);

      return await this.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

    } catch (error: any) {
      console.error('❌ Erro ao enviar email de recuperação de senha:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia email de boas-vindas
   */
  async sendWelcomeEmail(to: string, username: string, password?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const template = this.getWelcomeTemplate(username, frontendUrl, password);

      return await this.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

    } catch (error: any) {
      console.error('❌ Erro ao enviar email de boas-vindas:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia notificação por email
   */
  async sendNotificationEmail(to: string, notification: { title: string; message: string; type: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const template = this.getNotificationTemplate(notification);

      return await this.sendEmail({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

    } catch (error: any) {
      console.error('❌ Erro ao enviar email de notificação:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Template de recuperação de senha
   */
  private getPasswordResetTemplate(username: string, resetUrl: string, token: string): EmailTemplate {
    const subject = 'Recuperação de Senha - Smart Signage Pro';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperação de Senha</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Smart Signage Pro</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Recuperação de Senha</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${username}</strong>,</p>
          
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no Smart Signage Pro.</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Redefinir Senha
            </a>
          </p>
          
          <p>Ou copie e cole o link abaixo no seu navegador:</p>
          <p style="background: #e9e9e9; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">
            ${resetUrl}
          </p>
          
          ${process.env.NODE_ENV === 'development' ? `
          <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <strong>⚠️ Modo Desenvolvimento:</strong><br>
            Token: <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">${token}</code>
          </p>
          ` : ''}
          
          <p><strong>Este link expira em 1 hora.</strong></p>
          
          <p>Se você não solicitou esta recuperação de senha, ignore este email. Sua senha permanecerá inalterada.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            Este é um email automático, por favor não responda.<br>
            Smart Signage Pro - Sistema de Sinalização Digital
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
Smart Signage Pro - Recuperação de Senha

Olá ${username},

Recebemos uma solicitação para redefinir a senha da sua conta no Smart Signage Pro.

Clique no link abaixo para redefinir sua senha:
${resetUrl}

${process.env.NODE_ENV === 'development' ? `\nToken (modo desenvolvimento): ${token}\n` : ''}

Este link expira em 1 hora.

Se você não solicitou esta recuperação de senha, ignore este email. Sua senha permanecerá inalterada.

---
Este é um email automático, por favor não responda.
Smart Signage Pro - Sistema de Sinalização Digital
    `;

    return { subject, html, text };
  }

  /**
   * Template de boas-vindas
   */
  private getWelcomeTemplate(username: string, frontendUrl: string, password?: string): EmailTemplate {
    const subject = 'Bem-vindo ao Smart Signage Pro';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Bem-vindo ao Smart Signage Pro!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${username}</strong>,</p>
          
          <p>Sua conta foi criada com sucesso no Smart Signage Pro!</p>
          
          ${password ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0;"><strong>Suas credenciais de acesso:</strong></p>
            <p style="margin: 10px 0 0 0;">
              <strong>Usuário:</strong> ${username}<br>
              <strong>Senha temporária:</strong> ${password}
            </p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
              ⚠️ Por favor, altere sua senha no primeiro acesso.
            </p>
          </div>
          ` : ''}
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}/login" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Acessar Sistema
            </a>
          </p>
          
          <p>Se você tiver alguma dúvida, entre em contato com o suporte.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            Este é um email automático, por favor não responda.<br>
            Smart Signage Pro - Sistema de Sinalização Digital
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
Bem-vindo ao Smart Signage Pro!

Olá ${username},

Sua conta foi criada com sucesso no Smart Signage Pro!

${password ? `
Suas credenciais de acesso:
Usuário: ${username}
Senha temporária: ${password}

⚠️ Por favor, altere sua senha no primeiro acesso.
` : ''}

Acesse o sistema em: ${frontendUrl}/login

Se você tiver alguma dúvida, entre em contato com o suporte.

---
Este é um email automático, por favor não responda.
Smart Signage Pro - Sistema de Sinalização Digital
    `;

    return { subject, html, text };
  }

  /**
   * Template de notificação
   */
  private getNotificationTemplate(notification: { title: string; message: string; type: string }): EmailTemplate {
    const typeColors: { [key: string]: string } = {
      'info': '#17a2b8',
      'success': '#28a745',
      'warning': '#ffc107',
      'error': '#dc3545',
      'system_alert': '#dc3545'
    };

    const color = typeColors[notification.type] || '#667eea';
    const subject = `[Smart Signage Pro] ${notification.title}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${notification.title}</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid ${color};">
            <p style="margin: 0; white-space: pre-wrap;">${notification.message}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            Este é um email automático, por favor não responda.<br>
            Smart Signage Pro - Sistema de Sinalização Digital
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
[Smart Signage Pro] ${notification.title}

${notification.message}

---
Este é um email automático, por favor não responda.
Smart Signage Pro - Sistema de Sinalização Digital
    `;

    return { subject, html, text };
  }

  /**
   * Testa conexão SMTP
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }

      await this.transporter.verify();
      return true;

    } catch (error: any) {
      console.error('❌ Erro ao testar conexão SMTP:', error.message);
      return false;
    }
  }

  /**
   * Verifica se o serviço está habilitado
   */
  isServiceEnabled(): boolean {
    return this.isEnabled && this.transporter !== null;
  }
}

// Exportar instância singleton
export const emailService = new EmailService();

