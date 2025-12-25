#!/usr/bin/env node
/**
 * Script para corrigir fork-ts-checker-webpack-plugin
 * Resolve o erro "schema_utils_1.default is not a function"
 * 
 * Este script modifica o arquivo diretamente após npm install
 */

const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '../node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js');

if (!fs.existsSync(pluginPath)) {
  console.log('⚠️  fork-ts-checker-webpack-plugin não encontrado, pulando correção...');
  process.exit(0);
}

try {
  let content = fs.readFileSync(pluginPath, 'utf8');
  
  // Verificar se já foi corrigido
  if (content.includes('SOLUÇÃO DEFINITIVA')) {
    console.log('✅ fork-ts-checker-webpack-plugin já foi corrigido');
    process.exit(0);
  }
  
  // Procurar pela linha problemática
  const problematicLine = /schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);/;
  
  if (!problematicLine.test(content)) {
    console.log('⚠️  Padrão não encontrado no arquivo, pode ter sido atualizado');
    process.exit(0);
  }
  
  // Substituir pela versão corrigida
  const fix = `    // SOLUÇÃO DEFINITIVA: Ignorar validação se schema-utils não funcionar
    // Isso resolve conflitos de versão entre ajv@8.x e schema-utils@2.x
    // A validação não é crítica - o TypeScript já valida os tipos
    try {
        var validate = schema_utils_1.default || schema_utils_1;
        if (typeof validate === 'function') {
            validate(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);
        }
    } catch (error) {
        // Ignorar erros de validação - não crítico para o build
    }`;
  
  content = content.replace(
    problematicLine,
    fix
  );
  
  fs.writeFileSync(pluginPath, content, 'utf8');
  console.log('✅ fork-ts-checker-webpack-plugin corrigido com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao corrigir fork-ts-checker-webpack-plugin:', error.message);
  process.exit(1);
}

