import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_SRC = path.resolve(__dirname, '..', 'backend', 'src');

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

let filesModified = 0;
let fixedTypedParam = 0;
let fixedRefsOutOfScope = 0;
let fixedMessageOnUnknown = 0;
let fixedMovedConstEInside = 0;
let fixedStorageErrorRef = 0;
let fixedCatchMissingTypedParamE = 0;

const files = walk(BACKEND_SRC);
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;

  // ============================================================
  // 1. Corrigir catch (x) SEM tipo → adicionar :unknown, e se corpo usar x.message, criar const e
  // ============================================================
  // Passo 1a: Regex encontra catch (NAME) sem tipo, pede NAME qualquer coisa
  const catchUntypedRegex = /catch\s*\(\s*(\w+)\s*\)\s*\{/g;
  let match1;
  const catches1 = [];
  while ((match1 = catchUntypedRegex.exec(content)) !== null) {
    catches1.push({ m: match1, paramName: match1[1] });
  }
  if (catches1.length > 0) {
    catches1.sort((a, b) => b.m.index - a.m.index);
    for (const c of catches1) {
      const oldStr = c.m[0];
      // Substituir por catch (param: unknown) {
      const newStr = `catch (${c.paramName}: unknown) {`;
      content = content.slice(0, c.m.index) + newStr + content.slice(c.m.index + oldStr.length);
      fixedTypedParam++;
    }
  }

  // ============================================================
  // 2. Agora PARSEAR TODOS os blocos catch para verificar inconsistências:
  //    - Se corpo usa "X.message" onde X é catch param unknown → criar const e
  //    - Se corpo usa "e.X" mas não tem const e → criar
  //    - Se const e = normalizeError(...) está FORA do bloco e catch depois tem param errado
  //    - Storage: refs a "error" quando param é outro nome
  // ============================================================
  // Recriar catches após edição 1
  const catches = [];
  const catchAllRegex = /catch\s*\(\s*(\w+)(\s*:\s*\w+)?\s*\)\s*\{/g;
  let m;
  while ((m = catchAllRegex.exec(content)) !== null) {
    const braceOpenIdx = m.index + m[0].length - 1;
    let depth = 1;
    let i = braceOpenIdx + 1;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const braceCloseIdx = i - 1;
    catches.push({
      paramName: m[1],
      braceOpen: braceOpenIdx,
      braceClose: braceCloseIdx,
      get body() { return content.slice(this.braceOpen + 1, this.braceClose); },
      set body(v) {
        content = content.slice(0, this.braceOpen + 1) + v + content.slice(this.braceClose);
      }
    });
  }

  let needsWrite = false;

  for (let idx = 0; idx < catches.length; idx++) {
    const blk = catches[idx];
    let body = blk.body;

    // Check A: corpo usa `paramName.message` ou `paramName?.message` → param é unknown, não tem message
    // Substituir por referência a e.message e inserir const e = normalizeError(paramName)
    const messageRegex = new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.message\\b`, 'g');
    const stackRegex = new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.stack\\b`, 'g');
    const codeRegex = new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.code\\b`, 'g');
    const nameRegex = new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.name\\b`, 'g');
    const hasParamProp = messageRegex.test(body) || stackRegex.test(body) || codeRegex.test(body) || nameRegex.test(body);

    // Check B: corpo usa `e.` mas não há const e
    const usesE = /\be\.[a-zA-Z_]/.test(body);
    const hasConstE = /const\s+e\s*=\s*normalizeError\s*\(/.test(body);

    if ((hasParamProp && !hasConstE) || (usesE && !hasConstE)) {
      // Precisa criar const e
      let newBody = body;
      // Substituir param.message → e.message etc
      newBody = newBody.replace(new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.message\\b`, 'g'), 'e.message');
      newBody = newBody.replace(new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.stack\\b`, 'g'), 'e.error.stack');
      newBody = newBody.replace(new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.code\\b`, 'g'), '(e.raw as { code?: string })?.code');
      newBody = newBody.replace(new RegExp(`\\b${blk.paramName}\\s*(\\?)?\\.name\\b`, 'g'), 'e.error.name');
      // Inserir const e na 1a linha
      const lines = newBody.split('\n');
      // Determinar indentação
      let baseIndent = '  ';
      for (const ln of lines) {
        if (ln.trim().length > 0) { baseIndent = ln.match(/^\s*/)?.[0] || baseIndent; break; }
      }
      // Encontrar primeira linha não-vazia
      let insertIdx = 0;
      while (insertIdx < lines.length && lines[insertIdx].trim() === '') insertIdx++;
      lines.splice(insertIdx, 0, `${baseIndent}const e = normalizeError(${blk.paramName});`);
      body = lines.join('\n');
      fixedMessageOnUnknown++;
      blk.body = body;
      needsWrite = true;
    }

    // Check C: storage e outros usam literalmente a palavra `error` (nome antigo) mas paramName é outra coisa
    // Ex: catch (e: unknown) { ... error.message ... } → trocar error por e
    if (blk.paramName !== 'error' && blk.paramName !== 'e') {
      // Ver se há refs a error. propriedades mas param não é error
      const refsError = /\berror\s*\.\s*(message|stack|code|name|detail|constraint)/.test(body);
      if (refsError && !body.includes('const error')) {
        // Trocar refs a error.X → e.X
        const hasCE = /const\s+e\s*=\s*normalizeError\s*\(/.test(body);
        if (!hasCE) {
          // Inserir const e
          const lines = body.split('\n');
          let baseIndent = '  ';
          for (const ln of lines) {
            if (ln.trim().length > 0) { baseIndent = ln.match(/^\s*/)?.[0] || baseIndent; break; }
          }
          let insertIdx = 0;
          while (insertIdx < lines.length && lines[insertIdx].trim() === '') insertIdx++;
          lines.splice(insertIdx, 0, `${baseIndent}const e = normalizeError(${blk.paramName});`);
          body = lines.join('\n');
        }
        body = body.replace(/\berror\s*\.\s*message\b/g, 'e.message');
        body = body.replace(/\berror\s*\.\s*stack\b/g, 'e.error.stack');
        body = body.replace(/\berror\s*\.\s*code\b/g, '(e.raw as { code?: string })?.code');
        body = body.replace(/\berror\s*\.\s*name\b/g, 'e.error.name');
        body = body.replace(/\berror\s*\.\s*detail\b/g, '((e.raw as { detail?: string })?.detail)');
        blk.body = body;
        fixedStorageErrorRef++;
        needsWrite = true;
      }
    }

    // Check D: se ainda usa paramName quando const e criada → trocar refs para e.
    const hasConstENow = /const\s+e\s*=\s*normalizeError\s*\(/.test(blk.body);
    if (hasConstENow && blk.paramName !== 'e') {
      const hasParamAsArg = new RegExp(`const\\s+e\\s*=\\s*normalizeError\\s*\\(\\s*${blk.paramName}\\s*\\)`).test(blk.body);
      if (hasParamAsArg) {
        // O corpo NÃO deve mais usar paramName diretamente para acessar props
        // Substituir paramName.qualquer (exceto dentro de string/comentário) por e.
        const body2 = blk.body;
        let newBody2 = body2;
        // Trocar paramName.X → e.X  (qualquer propriedade)
        // Não trocar dentro do argumento de normalizeError: já verificamos
        newBody2 = newBody2.replace(
          new RegExp(`\\b${blk.paramName}\\s*\\.`, 'g'),
          'e.'
        );
        // Corrigir o e( dentro de const e = normalizeError( → voltar para paramName
        // Ex: const e = normalizeError(e.params); → deve ser const e = normalizeError(blk.paramName)
        newBody2 = newBody2.replace(
          new RegExp(`const\\s+e\\s*=\\s*normalizeError\\s*\\(\\s*e\\.`),
          `const e = normalizeError(${blk.paramName}.`
        );
        // Mas o mais comum é const e = normalizeError(e) sem .
        newBody2 = newBody2.replace(
          new RegExp(`const\\s+e\\s*=\\s*normalizeError\\s*\\(\\s*e\\s*\\)`),
          `const e = normalizeError(${blk.paramName})`
        );
        blk.body = newBody2;
        fixedCatchMissingTypedParamE++;
        needsWrite = true;
      }
    }

    // Check E: remover const e se ainda for unused (após todos os ajustes)
    let bodyFinal = blk.body;
    const unusedConstEMatch = bodyFinal.match(/^\s*(const\s+e\s*=\s*normalizeError\s*\(\s*\w+\s*\)\s*;)\s*$/m);
    if (unusedConstEMatch) {
      const bodyWO = bodyFinal.replace(unusedConstEMatch[0], '');
      const stillUsesE = /\be\.[a-zA-Z_]/.test(bodyWO);
      if (!stillUsesE) {
        bodyFinal = bodyWO;
        blk.body = bodyFinal;
        needsWrite = true;
        fixedRefsOutOfScope++;
      }
    }
  }

  // ============================================================
  // 3. Garantir import normalizeError existe se usado
  // ============================================================
  if (/normalizeError\s*\(/.test(content)) {
    const hasImport = /import\s*\{\s*normalizeError\s*\}\s*from\s*["'][^"']+["']/.test(content);
    if (!hasImport && !file.endsWith(path.join('backend', 'src', 'utils', 'errors.ts'))) {
      const filePathDir = path.dirname(file);
      const errorsPath = path.resolve(BACKEND_SRC, 'utils', 'errors.ts');
      let rel = path.relative(filePathDir, errorsPath);
      rel = rel.replace(/\.ts$/, '');
      if (!rel.startsWith('.')) rel = './' + rel;
      rel = rel.replace(/\\/g, '/');
      const lines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\s+/.test(lines[i])) lastImportIdx = i;
      }
      const importLine = `import { normalizeError } from '${rel}';`;
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine);
      } else {
        lines.splice(0, 0, importLine);
      }
      content = lines.join('\n');
      needsWrite = true;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    filesModified++;
  }
}

console.log(`fix v16 (param sem tipo + refs param direto + storage error):`);
console.log(`  - Arquivos modificados        : ${filesModified}`);
console.log(`  - Catch params tipados        : ${fixedTypedParam}`);
console.log(`  - Refs param.message → e.*    : ${fixedMessageOnUnknown}`);
console.log(`  - Troca "error" por param     : ${fixedStorageErrorRef}`);
console.log(`  - Param→e. após const e       : ${fixedCatchMissingTypedParamE}`);
console.log(`  - Cleanup unused e (última pass): ${fixedRefsOutOfScope}`);
