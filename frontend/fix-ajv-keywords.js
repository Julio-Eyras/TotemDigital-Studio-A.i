const fs = require('fs');
const path = require('path');

// Lista de arquivos schema-utils que precisam ser corrigidos
const filesToFix = [
  'node_modules/babel-loader/node_modules/schema-utils/dist/validate.js',
  'node_modules/file-loader/node_modules/schema-utils/dist/validate.js',
  'node_modules/fork-ts-checker-webpack-plugin/node_modules/schema-utils/dist/validate.js'
];

// Arquivos @eslint/eslintrc que precisam ser corrigidos
const eslintrcFiles = [
  'node_modules/@eslint/eslintrc/dist/eslintrc.cjs',
  'node_modules/@eslint/eslintrc/dist/eslintrc-universal.cjs'
];

let fixedCount = 0;

// Corrigir schema-utils
for (const relativePath of filesToFix) {
  const filePath = path.join(__dirname, relativePath);
  
  if (!fs.existsSync(filePath)) {
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Adicionar import do ajv-formats se não existir
  if (content.includes('formatMinimum') && content.includes('ajvKeywords')) {
    // Verificar se já tem ajv-formats
    if (!content.includes('ajv-formats') && !content.includes('ajvFormats')) {
      // Adicionar import do ajv-formats
      if (content.includes('const ajvKeywords = require')) {
        content = content.replace(
          /const ajvKeywords = require\(['"]ajv-keywords['"]\);?/,
          "const ajvKeywords = require('ajv-keywords');\nconst ajvFormats = require('ajv-formats');"
        );
        modified = true;
      } else if (content.includes('var _ajvKeywords')) {
        content = content.replace(
          /var _ajvKeywords = _interopRequireDefault\(require\(['"]ajv-keywords['"]\)\);?/,
          "var _ajvKeywords = _interopRequireDefault(require('ajv-keywords'));\nvar _ajvFormats = _interopRequireDefault(require('ajv-formats'));"
        );
        modified = true;
      }
    }
    
    // Remover formatMinimum e formatMaximum da lista de keywords
    if (content.includes("'formatMinimum', 'formatMaximum'") || content.includes('"formatMinimum", "formatMaximum"')) {
      // Formato com ajvKeywords direto
      content = content.replace(
        /ajvKeywords\(ajv, \['instanceof', 'formatMinimum', 'formatMaximum', 'patternRequired'\]\);/g,
        "ajvKeywords(ajv, ['instanceof', 'patternRequired']);\najvFormats(ajv);"
      );
      content = content.replace(
        /ajvKeywords\(ajv, \["instanceof", "formatMinimum", "formatMaximum", "patternRequired"\]\);/g,
        'ajvKeywords(ajv, ["instanceof", "patternRequired"]);\najvFormats(ajv);'
      );
      
      // Formato com _ajvKeywords.default
      content = content.replace(
        /\(0, _ajvKeywords\.default\)\(ajv, \['instanceof', 'formatMinimum', 'formatMaximum', 'patternRequired'\]\);/g,
        "(0, _ajvKeywords.default)(ajv, ['instanceof', 'patternRequired']);\n(0, _ajvFormats.default)(ajv);"
      );
      
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Corrigido: ${relativePath}`);
      fixedCount++;
    }
  }
}

// Corrigir @eslint/eslintrc
for (const relativePath of eslintrcFiles) {
  const filePath = path.join(__dirname, relativePath);
  
  if (!fs.existsSync(filePath)) {
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Adicionar verificação para ajv._opts antes de acessar defaultMeta
  if (content.includes('ajv._opts.defaultMeta = metaSchema.id') && !content.includes('if (ajv._opts)')) {
    content = content.replace(
      /ajv\.addMetaSchema\(metaSchema\);\s*\/\/ eslint-disable-next-line no-underscore-dangle\s*ajv\._opts\.defaultMeta = metaSchema\.id;/g,
      'ajv.addMetaSchema(metaSchema);\n    // eslint-disable-next-line no-underscore-dangle\n    if (ajv._opts) {\n        ajv._opts.defaultMeta = metaSchema.id;\n    }'
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Corrigido: ${relativePath}`);
    fixedCount++;
  }
}

if (fixedCount === 0) {
  console.log('✅ Todos os arquivos já estão corrigidos');
} else {
  console.log(`\n✅ Total de arquivos corrigidos: ${fixedCount}`);
}
