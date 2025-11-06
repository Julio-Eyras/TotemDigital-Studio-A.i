/**
 * Prometheus Configuration - Smart Signage v2.1
 * Configuração do Prometheus para queries PromQL
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do Prometheus
export const prometheusConfig = {
  url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  timeout: parseInt(process.env.PROMETHEUS_TIMEOUT || '30000'), // 30 segundos
};

/**
 * Executa query PromQL no Prometheus
 */
export async function executePrometheusQuery(query: string, startTime?: number, endTime?: number): Promise<any> {
  try {
    const start = startTime || Math.floor((Date.now() - 3600000) / 1000); // Última hora por padrão
    const end = endTime || Math.floor(Date.now() / 1000);
    
    // URL da API de query range do Prometheus
    const url = `${prometheusConfig.url}/api/v1/query_range`;
    
    const params = new URLSearchParams({
      query: query,
      start: start.toString(),
      end: end.toString(),
      step: '15s' // Intervalo de 15 segundos
    });

    const response = await axios.get(`${url}?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: prometheusConfig.timeout
    });

    const data = response.data;
    
    // Converter resposta do Prometheus para formato tabular
    return convertPrometheusResponseToTable(data);

  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Prometheus');
    }
    if (error.response) {
      throw new Error(`Prometheus API error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
    }
    throw new Error(`Erro ao executar query no Prometheus: ${error.message}`);
  }
}

/**
 * Executa query instantânea no Prometheus
 */
export async function executePrometheusInstantQuery(query: string, time?: number): Promise<any> {
  try {
    const queryTime = time || Math.floor(Date.now() / 1000);
    
    // URL da API de query instantânea do Prometheus
    const url = `${prometheusConfig.url}/api/v1/query`;
    
    const params = new URLSearchParams({
      query: query,
      time: queryTime.toString()
    });

    const response = await axios.get(`${url}?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: prometheusConfig.timeout
    });

    const data = response.data;
    
    // Converter resposta do Prometheus para formato tabular
    return convertPrometheusInstantResponseToTable(data);

  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Prometheus');
    }
    if (error.response) {
      throw new Error(`Prometheus API error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
    }
    throw new Error(`Erro ao executar query no Prometheus: ${error.message}`);
  }
}

/**
 * Converte resposta do Prometheus (range query) para formato tabular
 */
function convertPrometheusResponseToTable(prometheusResponse: any): any[] {
  try {
    const results: any[] = [];

    if (!prometheusResponse.data || !prometheusResponse.data.result) {
      return [];
    }

    const result = prometheusResponse.data.result;

    for (const metric of result) {
      const metricName = metric.metric?.__name__ || 'metric';
      const labels = metric.metric || {};
      const values = metric.values || [];

      for (const [timestamp, value] of values) {
        const row: any = {
          timestamp: new Date(timestamp * 1000).toISOString(),
          metric: metricName,
          value: parseFloat(value) || 0
        };

        // Adicionar labels como colunas
        Object.keys(labels).forEach(key => {
          if (key !== '__name__') {
            row[key] = labels[key];
          }
        });

        results.push(row);
      }
    }

    return results;

  } catch (error: any) {
    console.error('❌ Erro ao converter resposta do Prometheus:', error.message);
    return [];
  }
}

/**
 * Converte resposta do Prometheus (instant query) para formato tabular
 */
function convertPrometheusInstantResponseToTable(prometheusResponse: any): any[] {
  try {
    const results: any[] = [];

    if (!prometheusResponse.data || !prometheusResponse.data.result) {
      return [];
    }

    const result = prometheusResponse.data.result;

    for (const metric of result) {
      const metricName = metric.metric?.__name__ || 'metric';
      const labels = metric.metric || {};
      const [timestamp, value] = metric.value || [Date.now() / 1000, 0];

      const row: any = {
        timestamp: new Date(timestamp * 1000).toISOString(),
        metric: metricName,
        value: parseFloat(value) || 0
      };

      // Adicionar labels como colunas
      Object.keys(labels).forEach(key => {
        if (key !== '__name__') {
          row[key] = labels[key];
        }
      });

      results.push(row);
    }

    return results;

  } catch (error: any) {
    console.error('❌ Erro ao converter resposta do Prometheus:', error.message);
    return [];
  }
}

/**
 * Testa conexão com Prometheus
 */
export async function testPrometheusConnection(): Promise<boolean> {
  try {
    const url = `${prometheusConfig.url}/api/v1/status/config`;
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    return response.status === 200;

  } catch (error) {
    console.error('❌ Erro ao testar conexão Prometheus:', error);
    return false;
  }
}

