#!/usr/bin/env node
/**
 * Script de Validação de Placeholders SQL
 * 
 * Verifica se existem placeholders ? restantes nos arquivos TypeScript do backend
 * que deveriam usar placeholders PostgreSQL $1, $2...
 * 
 * Uso: node backend/scripts/validate-sql-placeholders.js
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Padrões para detectar placeholders ?
const patterns = [
  // VALUES (?, ?, ?)
  /VALUES\s*\([^)]*\?[^)]*\)/g,
  // SET campo = ?
  /SET\s+[^=]+\s*=\s*\?/g,
  // WHERE campo = ?
  /WHERE\s+[^=]+\s*=\s*\?/g,
  // LIKE ? ou ILIKE ?
  /(LIKE|ILIKE)\s+\?/g,
  // LIMIT ? ou OFFSET ?
  /(LIMIT|OFFSET)\s+\?/g,
];

// Exceções aceitáveis (comentários, strings literais, etc)
const exceptions = [
  /\/\/.*\?/, // Comentários
  /\/\*[\s\S]*?\*\//, // Comentários multi-linha
  /['"`].*\?.*['"`]/, // Strings literais
  /console\.(log|error|warn).*\?/, // Console.log com ?
];

function isException(line) {
  return exceptions.some(pattern => pattern.test(line));
}

function findPlaceholders(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // Ignorar exceções
    if (isException(line)) {
      return;
    }

    // Verificar cada padrão
    patterns.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        issues.push({
          line: index + 1,
          content: line.trim(),
          matches: matches
        });
      }
    });
  });

  return issues;
}

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Ignorar node_modules, dist, etc
      if (!['node_modules', 'dist', '.git', '__tests__'].includes(file)) {
        scanDirectory(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  console.log(`${colors.blue}🔍 Validando placeholders SQL...${colors.reset}\n`);

  const backendDir = path.join(__dirname, '..', 'src');
  const files = scanDirectory(backendDir);
  
  let totalIssues = 0;
  const filesWithIssues = [];

  files.forEach(file => {
    const issues = findPlaceholders(file);
    if (issues.length > 0) {
      totalIssues += issues.length;
      filesWithIssues.push({
        file: path.relative(backendDir, file),
        issues
      });
    }
  });

  // Exibir resultados
  if (filesWithIssues.length === 0) {
    console.log(`${colors.green}✅ Nenhum placeholder ? encontrado!${colors.reset}`);
    console.log(`${colors.green}   Todos os placeholders estão padronizados para PostgreSQL ($1, $2...).${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Encontrados ${totalIssues} placeholder(s) ? em ${filesWithIssues.length} arquivo(s):${colors.reset}\n`);

    filesWithIssues.forEach(({ file, issues }) => {
      console.log(`${colors.yellow}📄 ${file}${colors.reset}`);
      issues.forEach(({ line, content, matches }) => {
        console.log(`   ${colors.red}Linha ${line}:${colors.reset} ${content.substring(0, 80)}...`);
        console.log(`   ${colors.yellow}Padrão encontrado: ${matches.join(', ')}${colors.reset}\n`);
      });
    });

    console.log(`${colors.red}⚠️  Ação necessária: Substituir ? por $1, $2... nos arquivos acima.${colors.reset}\n`);
    process.exit(1);
  }
}

main();
