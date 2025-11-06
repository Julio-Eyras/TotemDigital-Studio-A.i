/**
 * Grafana Configuration - Smart Signage v2.1
 * Configuração do Grafana para queries de exportação
 */

import axios from 'axios';
import dotenv from 'dotenv';

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
export async function executeGrafanaQuery(query: string, datasourceId?: string): Promise<any> {
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
    return convertGrafanaResponseToTable(data);

  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Grafana');
    }
    if (error.response) {
      throw new Error(`Grafana API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
    }
    throw new Error(`Erro ao executar query no Grafana: ${error.message}`);
  }
}

/**
 * Converte resposta do Grafana para formato tabular
 */
function convertGrafanaResponseToTable(grafanaResponse: any): any[] {
  try {
    const results: any[] = [];

    if (!grafanaResponse.results || !grafanaResponse.results.A) {
      return [];
    }

    const result = grafanaResponse.results.A;
    
    if (result.frames && result.frames.length > 0) {
      // Formato de frames (novo formato do Grafana)
      for (const frame of result.frames) {
        if (frame.data && frame.data.values) {
          const columns = frame.schema?.fields?.map((f: any) => f.name) || [];
          const values = frame.data.values;
          
          // Converter para formato tabular
          for (let i = 0; i < values[0].length; i++) {
            const row: any = {};
            columns.forEach((col: string, idx: number) => {
              row[col] = values[idx][i];
            });
            results.push(row);
          }
        }
      }
    } else if (result.series && result.series.length > 0) {
      // Formato de séries (formato antigo do Grafana)
      for (const serie of result.series) {
        const columns = serie.columns || [];
        const values = serie.values || [];
        
        for (let i = 0; i < values.length; i++) {
          const row: any = {};
          columns.forEach((col: string, idx: number) => {
            row[col] = values[i][idx];
          });
          results.push(row);
        }
      }
    }

    return results;

  } catch (error: any) {
    console.error('❌ Erro ao converter resposta do Grafana:', error.message);
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

  } catch (error) {
    console.error('❌ Erro ao testar conexão Grafana:', error);
    return false;
  }
}

