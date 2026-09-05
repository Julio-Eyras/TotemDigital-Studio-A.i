/**
 * Prometheus Configuration - Smart Signage v2.1
 * Configuração do Prometheus para queries PromQL
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { normalizeError } from '../utils/errors';

dotenv.config();

// Configuração do Prometheus
export const prometheusConfig = {
  url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  timeout: parseInt(process.env.PROMETHEUS_TIMEOUT || '30000'), // 30 segundos
};

/**
 * Executa query PromQL no Prometheus
 */
export async function executePrometheusQuery(query: string, startTime?: number, endTime?: number): Promise<Record<string, unknown>[]> {
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
    return convertPrometheusResponseToTable(data);} catch (error: unknown) {
      const e = normalizeError(error);
    if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Prometheus');
    }
    const rawResp1 = (e.raw as { response?: { status?: number; data?: { error?: string }; statusText?: string } })?.response;
    if (rawResp1) {
      throw new Error(`Prometheus API error: ${rawResp1.status} - ${rawResp1.data?.error || rawResp1.statusText}`);
    }
    throw new Error(`Erro ao executar query no Prometheus: ${e.message}`);
  }
}

/**
 * Executa query instantânea no Prometheus
 */
export async function executePrometheusInstantQuery(query: string, time?: number): Promise<Record<string, unknown>[]> {
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
    return convertPrometheusInstantResponseToTable(data);} catch (error: unknown) {
      const e = normalizeError(error);
    if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
      throw new Error('Timeout ao executar query no Prometheus');
    }
    const rawResp2 = (e.raw as { response?: { status?: number; data?: { error?: string }; statusText?: string } })?.response;
    if (rawResp2) {
      throw new Error(`Prometheus API error: ${rawResp2.status} - ${rawResp2.data?.error || rawResp2.statusText}`);
    }
    throw new Error(`Erro ao executar query no Prometheus: ${e.message}`);
  }
}

/**
 * Converte resposta do Prometheus (range query) para formato tabular
 */
function convertPrometheusResponseToTable(prometheusResponse: unknown): Record<string, unknown>[] {
  try {
    const results: Record<string, unknown>[] = [];

    const resp = prometheusResponse as Record<string, unknown>;
    const dataObj = resp.data as Record<string, unknown> | undefined;
    const resultList = dataObj?.result as Array<Record<string, unknown>> | undefined;
    if (!resultList) {
      return [];
    }

    for (const metric of resultList) {
      const metricObj = metric.metric as Record<string, unknown> | undefined || {};
      const metricName = (metricObj.__name__ as string | undefined) || 'metric';
      const labels = metricObj as Record<string, unknown>;
      const values = (metric.values as Array<[number, string | number]> | undefined) || [];

      for (const [timestamp, value] of values) {
        const row: Record<string, unknown> = {
          timestamp: new Date(timestamp * 1000).toISOString(),
          metric: metricName,
          value: parseFloat(String(value)) || 0
        };

        Object.keys(labels).forEach(key => {
          if (key !== '__name__') {
            row[key] = labels[key];
          }
        });

        results.push(row);
      }
    }

    return results;} catch (error: unknown) {
const { logErrorSync } = require('../utils/loggerHelper');
    logErrorSync('Erro ao converter resposta do Prometheus', error, {});
    return [];
  }
}

/**
 * Converte resposta do Prometheus (instant query) para formato tabular
 */
function convertPrometheusInstantResponseToTable(prometheusResponse: unknown): Record<string, unknown>[] {
  try {
    const results: Record<string, unknown>[] = [];

    const resp = prometheusResponse as Record<string, unknown>;
    const dataObj = resp.data as Record<string, unknown> | undefined;
    const resultList = dataObj?.result as Array<Record<string, unknown>> | undefined;
    if (!resultList) {
      return [];
    }

    for (const metric of resultList) {
      const metricObj = metric.metric as Record<string, unknown> | undefined || {};
      const metricName = (metricObj.__name__ as string | undefined) || 'metric';
      const labels = metricObj as Record<string, unknown>;
      const valueArr = (metric.value as [number, string | number] | undefined) || [Date.now() / 1000, 0];
      const [timestamp, value] = valueArr;

      const row: Record<string, unknown> = {
        timestamp: new Date(timestamp * 1000).toISOString(),
        metric: metricName,
        value: parseFloat(String(value)) || 0
      };

      Object.keys(labels).forEach(key => {
        if (key !== '__name__') {
          row[key] = labels[key];
        }
      });

      results.push(row);
    }

    return results;} catch (error: unknown) {
const { logErrorSync } = require('../utils/loggerHelper');
    logErrorSync('Erro ao converter resposta do Prometheus (instant)', error, {});
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
} catch (error: unknown) {
    const { logErrorSync } = require('../utils/loggerHelper');
    logErrorSync('Erro ao testar conexão Prometheus', error, {});
    return false;
  }
}

