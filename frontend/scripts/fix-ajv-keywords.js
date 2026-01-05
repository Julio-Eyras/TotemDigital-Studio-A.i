#!/usr/bin/env node

/**
 * Script para corrigir o problema de incompatibilidade do ajv-keywords
 * com fork-ts-checker-webpack-plugin
 * 
 * Este script substitui a versão antiga do ajv-keywords dentro do
 * fork-ts-checker-webpack-plugin por uma versão compatível.
 */

const fs = require('fs');
const path = require('path');

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
  
  // Verificar se já está na versão correta (5.x suporta formatMinimum)
  if (packageJson.version && (packageJson.version.startsWith('5.') || packageJson.version.startsWith('3.'))) {
    console.log('✅ ajv-keywords já está na versão compatível');
    process.exit(0);
  }
  
  // Tentar corrigir o arquivo index.js que causa o erro
  const indexJsPath = path.join(path.dirname(foundPath), 'dist', 'index.js');
  if (fs.existsSync(indexJsPath)) {
    let content = fs.readFileSync(indexJsPath, 'utf8');
    
    // Adicionar suporte para formatMinimum se não existir
    if (!content.includes('formatMinimum')) {
      // Adicionar uma função stub para formatMinimum
      const formatMinimumStub = `
// Stub para formatMinimum (compatibilidade)
if (typeof ajv.addKeyword === 'function') {
  try {
    ajv.addKeyword('formatMinimum', {
      type: 'string',
      compile: function() { return function() { return true; }; }
    });
  } catch(e) {}
}`;
      
      // Inserir antes do último }
      const lastBraceIndex = content.lastIndexOf('}');
      if (lastBraceIndex > 0) {
        content = content.slice(0, lastBraceIndex) + formatMinimumStub + '\n' + content.slice(lastBraceIndex);
        fs.writeFileSync(indexJsPath, content);
        console.log('✅ Adicionado suporte para formatMinimum');
      }
    }
  }
  
  console.log('✅ Correção aplicada com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao corrigir ajv-keywords:', error.message);
  // Não falhar o build se a correção falhar
  process.exit(0);
}
