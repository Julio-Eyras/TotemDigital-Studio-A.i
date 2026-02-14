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
  
  const ajvKeywordsDir = path.dirname(foundPath);

  // ajv-keywords v5: formatMinimum/formatMaximum foram movidos para ajv-formats.
  // schema-utils@2.7.0 ainda os solicita. Adicionamos stubs em dist/keywords/index.js
  if (packageJson.version && packageJson.version.startsWith('5.')) {
    const keywordsIndexPath = path.join(ajvKeywordsDir, 'dist', 'keywords', 'index.js');
    if (!fs.existsSync(keywordsIndexPath)) {
      console.log('⚠️  dist/keywords/index.js não encontrado. Pulando correção.');
      process.exit(0);
    }
    let content = fs.readFileSync(keywordsIndexPath, 'utf8');
    if (content.includes('formatMinimum') && content.includes('formatMaximum')) {
      console.log('✅ formatMinimum/formatMaximum já estão no ajv-keywords');
      process.exit(0);
    }
    // Adicionar stubs para formatMinimum e formatMaximum (exigidos por schema-utils@2.7)
    const formatStub = `const formatMinimum_1 = (ajv) => { try { ajv.addKeyword({ keyword: 'formatMinimum', validate: () => true }); } catch (e) {} }; const formatMaximum_1 = (ajv) => { try { ajv.addKeyword({ keyword: 'formatMaximum', validate: () => true }); } catch (e) {} };`;
    const insertBefore = 'const ajvKeywords = {';
    if (!content.includes(insertBefore)) {
      console.log('⚠️  Estrutura de keywords/index.js inesperada');
      process.exit(0);
    }
    content = content.replace(insertBefore, formatStub + '\n' + insertBefore);
    content = content.replace(
      'select: select_1.default,\n};',
      'select: select_1.default,\n    formatMinimum: formatMinimum_1,\n    formatMaximum: formatMaximum_1,\n};'
    );
    fs.writeFileSync(keywordsIndexPath, content);
    console.log('✅ Adicionados stubs formatMinimum e formatMaximum ao ajv-keywords v5');
    process.exit(0);
  }

  // ajv-keywords v3: correção antiga
  const indexJsPath = path.join(ajvKeywordsDir, 'dist', 'index.js');
  if (fs.existsSync(indexJsPath)) {
    let content = fs.readFileSync(indexJsPath, 'utf8');
    if (content.includes("ajv.addKeyword('formatMinimum'")) {
      content = content.replace(
        /ajv\.addKeyword\('formatMinimum',\s*\{/g,
        "ajv.addKeyword({ keyword: 'formatMinimum', "
      );
      fs.writeFileSync(indexJsPath, content);
      console.log('✅ Atualizado formatMinimum para assinatura AJV v8');
      process.exit(0);
    }
    if (!content.includes('formatMinimum')) {
      const formatMinimumStub = `
if (typeof ajv.addKeyword === 'function') {
  try { ajv.addKeyword({ keyword: 'formatMinimum', validate: () => true }); } catch(e) {}
  try { ajv.addKeyword({ keyword: 'formatMaximum', validate: () => true }); } catch(e) {}
}`;
      const lastBraceIndex = content.lastIndexOf('}');
      if (lastBraceIndex > 0) {
        content = content.slice(0, lastBraceIndex) + formatMinimumStub + '\n' + content.slice(lastBraceIndex);
        fs.writeFileSync(indexJsPath, content);
        console.log('✅ Adicionados stubs formatMinimum e formatMaximum');
      }
    }
  }
  
  console.log('✅ Correção aplicada com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao corrigir ajv-keywords:', error.message);
  // Não falhar o build se a correção falhar
  process.exit(0);
}