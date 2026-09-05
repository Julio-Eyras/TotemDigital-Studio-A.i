/**
 * Grafana Configuration - Smart Signage v2.1
 * Configuração do Grafana para queries de exportação
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { normalizeError } from '../utils/errors';

dotenv.config();

// Configuração do Grafana
export const grafanaConfig = {
  url: process.env.GRAFANA_URL || 'http://localhost:3002',
  apiKey: process.env.GRAFANA_API_KEY || undefined,
  username: process.env.GRAFANA_USERNAME || 'admin',
  password: process.env.GRAFANA_PASSWORD || 'admin',
  datasourceId: process.env.GRAFANA_DATASOURCE_ID || '1', // ID do datasource Prometheus
  timeout: parseInt(process.env.GRAFANA_TIMEOUT || '30000'), // 30 segundos
};

/**
 * Executa query no Grafana
 */
export async function executeGrafanaQuery(query: string, datasourceId?: string): Promise<Record<string, unknown>[]> {
  try {
    const url = `${grafanaConfig.url}/api/ds/query`;
    const dsId = datasourceId || grafanaConfig.datasourceId;

    // Preparar autenticação
    const auth = grafanaConfig.apiKey
      ? { 'Authorization': `Bearer ${grafanaConfig.apiKey}` }
      : {
          'Authorization': `Basic ${Buffer.from(`${grafanaConfig.username}:${grafanaConfig.password}`).toString('base64')}`
        };

    // Preparar payload da query
    const payload = {
      queries: [
        {
          datasource: { uid: dsId },
          expr: query, // PromQL query ou SQL dependendo do datasource
          refId: 'A',
          format: 'table',
          instant: false,
          range: true
        }
      ],
      from: Date.now() - 3600000, // Última hora
      to: Date.now()
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...auth
      },
      timeout: grafanaConfig.timeout
    });

    const data = response.data;
    
    // Converter resposta do Grafana para formato tabular
    return convertGrafanaResponseToTable(data);} catch (error: unknown) {
      const e = normalizeError(error);
    if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Grafana');
    }
    const rawResp = (e.raw as { response?: { status?: number; data?: { message?: string }; statusText?: string } })?.response;
    if (rawResp) {
      throw new Error(`Grafana API error: ${rawResp.status} - ${rawResp.data?.message || rawResp.statusText}`);
    }
    throw new Error(`Erro ao executar query no Grafana: ${e.message}`);
  }
}

/**
 * Converte resposta do Grafana para formato tabular
 */
function convertGrafanaResponseToTable(grafanaResponse: unknown): Record<string, unknown>[] {
  try {
    const results: Record<string, unknown>[] = [];

    const resp = grafanaResponse as Record<string, unknown>;
    const resultsObj = resp.results as Record<string, unknown> | undefined;
    const resultA = resultsObj?.A as Record<string, unknown> | undefined;
    if (!resultA) {
      return [];
    }

    const frames = resultA.frames as Array<Record<string, unknown>> | undefined;
    if (frames && frames.length > 0) {
      for (const frame of frames) {
        const frameData = frame.data as { values?: unknown[][] } | undefined;
        if (frameData?.values) {
          const schema = frame.schema as { fields?: Array<{ name?: string }> } | undefined;
          const columns = schema?.fields?.map((f) => f.name ?? '') || [];
          const values = frameData.values;

          for (let i = 0; i < (values[0]?.length || 0); i++) {
            const row: Record<string, unknown> = {};
            columns.forEach((col: string, idx: number) => {
              row[col] = values[idx]?.[i];
            });
            results.push(row);
          }
        }
      }
    } else {
      const series = resultA.series as Array<Record<string, unknown>> | undefined;
      if (series && series.length > 0) {
        for (const serie of series) {
          const columns = (serie.columns as string[] | undefined) || [];
          const values = (serie.values as unknown[][] | undefined) || [];

          for (let i = 0; i < values.length; i++) {
            const row: Record<string, unknown> = {};
            columns.forEach((col: string, idx: number) => {
              row[col] = values[i][idx];
            });
            results.push(row);
          }
        }
      }
    }

    return results;} catch (error: unknown) {
const { logErrorSync } = require('../utils/loggerHelper');
    logErrorSync('Erro ao converter resposta do Grafana', error, {});
    return [];
  }
}

/**
 * Testa conexão com Grafana
 */
export async function testGrafanaConnection(): Promise<boolean> {
  try {
    const url = `${grafanaConfig.url}/api/health`;
    const auth = grafanaConfig.apiKey
      ? { 'Authorization': `Bearer ${grafanaConfig.apiKey}` }
      : {
          'Authorization': `Basic ${Buffer.from(`${grafanaConfig.username}:${grafanaConfig.password}`).toString('base64')}`
        };

    const response = await axios.get(url, {
      headers: auth,
      timeout: 5000
    });

    return response.status === 200;
} catch (error: unknown) {
    const { logErrorSync } = require('../utils/loggerHelper');
    logErrorSync('Erro ao testar conexão Grafana', error, {});
    return false;
  }
}

