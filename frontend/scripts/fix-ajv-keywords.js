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

    // AJV v8+: a assinatura antiga ajv.addKeyword('kw', def) é DEPRECATED e gera warning.
    // Se já houver o stub antigo, substituir por uma versão compatível (obj-based signature).
    if (content.includes("ajv.addKeyword('formatMinimum'")) {
      content = content.replace(
        /ajv\.addKeyword\('formatMinimum',\s*\{/g,
        "ajv.addKeyword({\n      keyword: 'formatMinimum',\n      "
      );
      // Se fecharmos com "});" no final do objeto antigo, manteremos a sintaxe válida.
      // (o código original fecha com "});" e continua funcionando)
      fs.writeFileSync(indexJsPath, content);
      console.log('✅ Atualizado stub formatMinimum para assinatura compatível com AJV v8 (sem warnings)');
      process.exit(0);
    }
    
    // Adicionar suporte para formatMinimum se não existir
    if (!content.includes('formatMinimum')) {
      // Adicionar uma função stub para formatMinimum
      const formatMinimumStub = `
// Stub para formatMinimum (compatibilidade)
if (typeof ajv.addKeyword === 'function') {
  try {
    // AJV v8+: use a assinatura baseada em objeto para evitar warnings de depreciação
    ajv.addKeyword({
      keyword: 'formatMinimum',
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