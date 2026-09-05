import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const PATH = resolve(process.cwd(), 'backend/src/services/remoteCommandService.ts');
let c = readFileSync(PATH, 'utf-8');
const findBraceProblems = (text) => {
  const problems = [];
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') stack.push({ ch, i });
    else if (ch === '}' || ch === ')' || ch === ']') {
      const top = stack.pop();
      if (!top) problems.push({ unmatchClose: ch, pos: i, snippet: text.slice(Math.max(0, i-40), i+40) });
    }
  }
  if (stack.length > 0) problems.push({ openRemaining: stack.slice(-5) });
  return problems;
};
const probs = findBraceProblems(c);
console.log('Problems:', probs.length);
for (const p of probs.slice(0, 10)) {
  console.log(JSON.stringify(p, null, 2));
}
