/**
 * Subscriber Isolation Middleware
 * Garante que subscribers só acessam seus próprios dados
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logError, logWarn } from '../utils/loggerHelper';

/**
 * Middleware que garante isolamento de dados por subscriber
 * 
 * Para usuários com role 'subscriber' ou 'client':
 * - Adiciona subscriberId ao request
 * - Valida que subscriberId existe
 * - Bloqueia acesso se não houver subscriberId
 */
export const subscriberIsolationMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Apenas aplicar para subscribers/clients
        if (req.user && (req.user.role === 'subscriber' || req.user.role === 'client')) {
            // Tentar obter subscriberId do usuário
            const subscriberId = req.user.subscriberId || (req.user as any).subscriber_id;
            
            if (!subscriberId || typeof subscriberId !== 'number') {
                await logWarn('Tentativa de acesso sem subscriberId identificado', {
                    userId: req.user.id,
                    role: req.user.role,
                    user: req.user
                });
                
                res.status(403).json({
                    success: false,
                    error: 'Acesso negado',
                    message: 'Subscriber ID não identificado. Contate o administrador.'
                });
                return;
            }
            
            // Adicionar subscriberId ao request para uso nos serviços
            req.subscriberId = subscriberId;
            
            await logWarn('Subscriber isolation aplicado', {
                userId: req.user.id,
                subscriberId: subscriberId
            });
        }
        
        // Admin e outros roles podem passar sem restrição
        next();
    } catch (error: any) {
        await logError('Erro no middleware de isolamento de subscriber', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Erro ao validar permissões de acesso'
        });
    }
};

/**
 * Helper para validar que um recurso pertence ao subscriber
 */
export const validateSubscriberOwnership = async (
    resourceSubscriberId: number | null | undefined,
    requestSubscriberId: number | undefined,
    resourceType: string = 'recurso'
): Promise<void> => {
    if (!requestSubscriberId) {
        throw new Error(`Acesso negado: subscriberId não identificado`);
    }
    
    if (!resourceSubscriberId) {
        throw new Error(`${resourceType} não possui subscriber_id`);
    }
    
    if (resourceSubscriberId !== requestSubscriberId) {
        throw new Error(`Acesso negado: ${resourceType} não pertence a este subscriber`);
    }
};

