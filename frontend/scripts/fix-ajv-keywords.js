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

// Encontrar todas as cópias de ajv-keywords (babel-loader, file-loader, schema-utils, etc.)
const nodeModules = path.join(__dirname, '..', 'node_modules');
const possiblePaths = [
  path.join(nodeModules, 'babel-loader', 'node_modules', 'ajv-keywords'),
  path.join(nodeModules, 'file-loader', 'node_modules', 'ajv-keywords'),
  path.join(nodeModules, 'fork-ts-checker-webpack-plugin', 'node_modules', 'schema-utils', 'node_modules', 'ajv-keywords'),
  path.join(nodeModules, 'fork-ts-checker-webpack-plugin', 'node_modules', 'ajv-keywords'),
  path.join(nodeModules, 'schema-utils', 'node_modules', 'ajv-keywords'),
];

function patchAjvKeywordsV5(ajvKeywordsDir) {
  const keywordsIndexPath = path.join(ajvKeywordsDir, 'dist', 'keywords', 'index.js');
  if (!fs.existsSync(keywordsIndexPath)) return false;
  let content = fs.readFileSync(keywordsIndexPath, 'utf8');
  if (content.includes('formatMinimum_1') && content.includes('formatMaximum_1')) return true;
  const formatStub = `const formatMinimum_1 = (ajv) => { try { ajv.addKeyword({ keyword: 'formatMinimum', validate: () => true }); } catch (e) {} }; const formatMaximum_1 = (ajv) => { try { ajv.addKeyword({ keyword: 'formatMaximum', validate: () => true }); } catch (e) {} };`;
  const insertBefore = 'const ajvKeywords = {';
  if (!content.includes(insertBefore)) return false;
  content = content.replace(insertBefore, formatStub + '\n' + insertBefore);
  const selectExport = 'select: select_1.default,\n};';
  if (!content.includes(selectExport)) return false;
  content = content.replace(
    selectExport,
    'select: select_1.default,\n    formatMinimum: formatMinimum_1,\n    formatMaximum: formatMaximum_1,\n};'
  );
  fs.writeFileSync(keywordsIndexPath, content);
  return true;
}

let patched = 0;
for (const testPath of possiblePaths) {
  const packageJsonPath = path.join(testPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) continue;
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.version && packageJson.version.startsWith('5.')) {
      if (patchAjvKeywordsV5(testPath)) {
        console.log(`✅ Patched ajv-keywords v${packageJson.version}: ${path.relative(nodeModules, testPath)}`);
        patched++;
      }
    } else {
      const indexJsPath = path.join(testPath, 'dist', 'index.js');
      if (fs.existsSync(indexJsPath)) {
        let content = fs.readFileSync(indexJsPath, 'utf8');
        if (!content.includes('formatMinimum')) {
          const stub = `if (typeof ajv.addKeyword === 'function') { try { ajv.addKeyword({ keyword: 'formatMinimum', validate: () => true }); } catch(e) {} try { ajv.addKeyword({ keyword: 'formatMaximum', validate: () => true }); } catch(e) {} }`;
          const lastBrace = content.lastIndexOf('}');
          if (lastBrace > 0) {
            content = content.slice(0, lastBrace) + stub + '\n' + content.slice(lastBrace);
            fs.writeFileSync(indexJsPath, content);
            console.log(`✅ Patched ajv-keywords v${packageJson.version}: ${path.relative(nodeModules, testPath)}`);
            patched++;
          }
        }
      }
    }
  } catch (e) {
    // ignorar
  }
}

if (patched === 0) {
  console.log('⚠️  Nenhuma cópia de ajv-keywords precisou de correção.');
} else {
  console.log(`✅ Correção aplicada em ${patched} cópia(s).`);
}