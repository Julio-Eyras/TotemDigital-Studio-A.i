/**
 * Facial Recognition Service - Smart Signage Pro v2.1
 * Serviço para gerenciar reconhecimento facial e personalização
 */

import { getDatabase } from '../config/database';
import { logInfo, logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface RecognizedPerson {
  id: number;
  personId: string;
  name?: string;
  features: Record<string, unknown>; // Características faciais (JSON)
  contentId?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacialMatchRequest {
  features: Record<string, unknown>; // Características faciais extraídas
  totemId?: number;
}

export interface FacialMatchResponse {
  personId?: string;
  contentId?: number;
  confidence?: number;
  name?: string;
}

export class FacialRecognitionService {
  private get db() {
    return getDatabase();
  }

  /**
   * Tenta fazer match de características faciais
   */
  async matchFace(_request: FacialMatchRequest): Promise<FacialMatchResponse | null> {
    try {
      // Por enquanto, retornar conteúdo padrão
      // Em produção, implementar algoritmo de matching real
      
      // Buscar pessoa com características similares
      const persons = await this.db.findMany(`
        SELECT * FROM recognized_persons
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Se houver pessoas cadastradas, retornar primeira (simplificado)
      // Em produção, comparar features usando algoritmo de ML
      if (persons.length > 0) {
        const person = persons[0];
        return {
          personId: person.person_id,
          contentId: person.content_id || null,
          confidence: 0.7, // Placeholder
          name: person.name || undefined
        };
      }

      // Retornar null se não houver match
      return null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao fazer match facial', e.error);
      return null;
    }
  }

  /**
   * Cria ou atualiza pessoa reconhecida
   */
  async createOrUpdatePerson(
    personId: string,
    data: {
      name?: string;
      features: Record<string, unknown>;
      contentId?: number;
    }
  ): Promise<RecognizedPerson> {
    try {
      const existing = await this.db.findFirst(`
        SELECT * FROM recognized_persons WHERE person_id = $1
      `, [personId]);

      if (existing) {
        // Atualizar
        const result = await this.db.executeRaw(`
          UPDATE recognized_persons
          SET name = $1, features = $2, content_id = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE person_id = $4
          RETURNING *
        `, [
          data.name || null,
          data.features ? JSON.stringify(data.features) : null,
          data.contentId || null,
          personId
        ]);

        await logInfo('Pessoa atualizada', { personId });
        return this.mapToPerson(result.rows[0]);
      } else {
        // Criar
        const result = await this.db.executeRaw(`
          INSERT INTO recognized_persons (person_id, name, features, content_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          personId,
          data.name || null,
          data.features ? JSON.stringify(data.features) : null,
          data.contentId || null
        ]);

        await logInfo('Pessoa criada', { personId });
        return this.mapToPerson(result.rows[0]);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar/atualizar pessoa', e.error, { personId });
      throw e.error;
    }
  }

  /**
   * Lista pessoas reconhecidas
   */
  async getAllPersons(filters?: {
    isActive?: boolean;
    limit?: number;
  }): Promise<RecognizedPerson[]> {
    try {
      let query = 'SELECT * FROM recognized_persons WHERE 1=1';
      const params: unknown[] = [];

      if (filters?.isActive !== undefined) {
        query += ' AND is_active = $' + (params.length + 1);
        params.push(filters.isActive);
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }

      const persons = await this.db.findMany(query, params);
      return persons.map(person => this.mapToPerson(person));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar pessoas', e.error);
      throw e.error;
    }
  }

  /**
   * Registra interação de reconhecimento facial
   */
  async logInteraction(data: {
    totemId: number;
    personId?: string;
    contentId?: number;
    features: Record<string, unknown>;
    confidence?: number;
  }): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO interaction_logs (
          totem_id, interaction_type, interaction_data, content_id, person_id
        )
        VALUES ($1, 'facial_recognition', $2, $3, $4)
      `, [
        data.totemId,
        JSON.stringify({
          features: data.features,
          confidence: data.confidence
        }),
        data.contentId || null,
        data.personId || null
      ]);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao registrar interação', e.error);
    }
  }

  /**
   * Mapeia resultado do banco para RecognizedPerson
   */
  private mapToPerson(row: any): RecognizedPerson {
    return {
      id: row.id,
      personId: row.person_id,
      name: row.name,
      features: row.features ? JSON.parse(row.features) : undefined,
      contentId: row.content_id,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// Singleton instance
let facialRecognitionServiceInstance: FacialRecognitionService | null = null;

export function getFacialRecognitionService(): FacialRecognitionService {
  if (!facialRecognitionServiceInstance) {
    facialRecognitionServiceInstance = new FacialRecognitionService();
  }
  return facialRecognitionServiceInstance;
}

