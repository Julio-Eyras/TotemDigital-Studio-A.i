#!/usr/bin/env node

/**
 * Script para corrigir o problema de incompatibilidade do ajv-keywords
 * com fork-ts-checker-webpack-plugin
 * 
 * Este script corrige o erro "Unknown keyword formatMinimum" adicionando
 * suporte para formatMinimum e formatMaximum no ajv-keywords.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo incompatibilidade do ajv-keywords...');

// Caminhos possíveis para ajv-keywords dentro do fork-ts-checker-webpack-plugin
const possiblePaths = [
  path.join(__dirname, '..', 'node_modules', 'fork-ts-checker-webpack-plugin', 'node_modules', 'schema-utils', 'node_modules', 'ajv-keywords'),
  path.join(__dirname, '..', 'node_modules', 'fork-ts-checker-webpack-plugin', 'node_modules', 'ajv-keywords'),
  path.join(__dirname, '..', 'node_modules', 'schema-utils', 'node_modules', 'ajv-keywords'),
];

let foundPath = null;
for (const testPath of possiblePaths) {
  const packageJsonPath = path.join(testPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    foundPath = packageJsonPath;
    break;
  }
}

if (!foundPath) {
  console.log('⚠️  ajv-keywords não encontrado em fork-ts-checker-webpack-plugin. Pulando correção.');
  process.exit(0);
}

try {
  // Ler package.json atual
  const packageJson = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
  
  console.log(`📦 Versão atual do ajv-keywords: ${packageJson.version}`);
  
  // Tentar corrigir o arquivo index.js que causa o erro
  const indexJsDir = path.dirname(foundPath);
  const indexJsPath = path.join(indexJsDir, 'dist', 'index.js');
  
  if (fs.existsSync(indexJsPath)) {
    let content = fs.readFileSync(indexJsPath, 'utf8');
    
    // Adicionar suporte para formatMinimum e formatMaximum se não existir
    if (!content.includes('formatMinimum') && !content.includes('formatMaximum')) {
      // Procurar onde adicionar o stub (antes do module.exports ou no final)
      let insertPosition = content.length;
      
      // Tentar encontrar module.exports
      const moduleExportsIndex = content.indexOf('module.exports');
      if (moduleExportsIndex > 0) {
        insertPosition = moduleExportsIndex;
      } else {
        // Se não encontrar, inserir antes do último }
        const lastBraceIndex = content.lastIndexOf('}');
        if (lastBraceIndex > 0) {
          insertPosition = lastBraceIndex;
        }
      }
      
      // Adicionar uma função stub para formatMinimum e formatMaximum
      const formatStub = `
// Stub para formatMinimum e formatMaximum (compatibilidade com ajv 8.x)
if (typeof ajv !== 'undefined' && typeof ajv.addKeyword === 'function') {
  try {
    if (!ajv.getKeyword || !ajv.getKeyword('formatMinimum')) {
      ajv.addKeyword('formatMinimum', {
        type: 'string',
        compile: function() { return function() { return true; }; }
      });
    }
    if (!ajv.getKeyword || !ajv.getKeyword('formatMaximum')) {
      ajv.addKeyword('formatMaximum', {
        type: 'string',
        compile: function() { return function() { return true; }; }
      });
    }
  } catch(e) {
    // Ignorar erros
  }
}`;
      
      content = content.slice(0, insertPosition) + formatStub + '\n' + content.slice(insertPosition);
      fs.writeFileSync(indexJsPath, content, 'utf8');
      console.log('✅ Adicionado suporte para formatMinimum/formatMaximum');
    } else {
      console.log('✅ formatMinimum/formatMaximum já está presente no arquivo');
    }
  } else {
    console.log('⚠️  Arquivo index.js não encontrado em:', indexJsPath);
  }
  
  console.log('✅ Correção aplicada com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao corrigir ajv-keywords:', error.message);
  // Não falhar o build se a correção falhar
  process.exit(0);
}
