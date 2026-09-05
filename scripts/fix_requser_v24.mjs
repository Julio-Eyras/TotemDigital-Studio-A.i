import fs from 'fs';
import path from 'path';

const SRC = path.resolve(process.cwd(), 'backend/src/routes');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, files);
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC);
console.log(`[v24] Processing ${files.length} route files for req.user non-null`);

let fixed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const before = content;

  // req.user.prop → req.user!.prop (apenas 1 nível)
  content = content.replace(/req\.user\.([A-Za-z_]\w*)/g, 'req.user!.$1');

  if (content !== before) {
    fs.writeFileSync(file, content, 'utf8');
    fixed++;
  }
}

console.log(`[v24] Done. ${fixed} files modified.`);
