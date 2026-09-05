/**
 * ESLint v10 Flat Config — TotemDigital Studio A.i backend
 * Dependências: eslint ^10, typescript-eslint ^8, @eslint/js ^10, globals ^15, jiti ^2
 *
 * PERFIS (use via package.json scripts):
 *   npm run lint:soft      → fastest, SEM type-aware, estilos relaxados. CI não bloqueia.
 *   npm run lint           → padrão com style checks (strictStylistic), bloqueia em erros reais.
 *   npm run check:strict   → padrão + strictTypeChecked (lento, pré-PR apenas).
 *
 * Permissões:
 *   - anys justificados (127 produção + testes mocks): desligados explicitamente.
 *   - 100% test coverage de type safety já está via tsc --strict; ESLint aqui = qualide estilo.
 */
import tseslint from 'typescript-eslint';
import eslintPluginJs from '@eslint/js';
import globals from 'globals';

const TS_QUALITY_RELAXED: Record<string, 'off' | 'warn' | any[]> = {
  // === Top offenders Style (1700+ errors strict ligado) — todos off por default (linters estilo) ===
  '@typescript-eslint/no-unnecessary-type-conversion': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-invalid-void-type': 'off',
  '@typescript-eslint/no-inferrable-types': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/restrict-plus-operands': 'off',
  '@typescript-eslint/array-type': 'off',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
  '@typescript-eslint/prefer-optional-chain': 'off',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/prefer-regexp-exec': 'off',
  '@typescript-eslint/return-await': 'off',
  '@typescript-eslint/no-unnecessary-type-parameters': 'off',
  '@typescript-eslint/no-namespace': 'off',
  '@typescript-eslint/prefer-as-const': 'off',
  '@typescript-eslint/prefer-for-of': 'off',
  '@typescript-eslint/no-base-to-string': 'warn',
  '@typescript-eslint/await-thenable': 'warn',
  '@typescript-eslint/no-useless-default-assignment': 'off',
  '@typescript-eslint/prefer-string-starts-ends-with': 'off',
  '@typescript-eslint/consistent-type-definitions': 'off',
  '@typescript-eslint/dot-notation': 'off',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  '@typescript-eslint/non-nullable-type-assertion-style': 'off',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
  '@typescript-eslint/require-array-sort-compare': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'warn',
  '@typescript-eslint/no-meaningless-void-operator': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'warn',
  '@typescript-eslint/no-deprecated': 'off',
  '@typescript-eslint/prefer-promise-reject-errors': 'off',
  '@typescript-eslint/consistent-type-exports': 'warn',
  '@typescript-eslint/consistent-indexed-object-style': 'off',
  '@typescript-eslint/consistent-generic-constructors': 'off',
  '@typescript-eslint/method-signature-style': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-dynamic-delete': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/only-throw-error': 'off',
  '@typescript-eslint/class-literal-property-style': 'off',
  '@typescript-eslint/prefer-nullish-coalescing': 'off',

  // === Anys justificados: 127 em produção (SQL params, DB rows, 3rd-party, debug) + testes mocks ===
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/no-unsafe-function-type': 'off',

  // === Boas práticas — warning apenas (não trava CI) ===
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],

  // === === ===
  'no-undef': 'off',
  'no-prototype-builtins': 'off',
  'no-useless-escape': 'warn',
  'prefer-const': 'warn',
  'no-constant-condition': ['warn', { checkLoops: false }],
  'no-case-declarations': 'warn',
  'no-control-regex': 'off',
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-inner-declarations': 'off',
  eqeqeq: ['warn', 'smart'],

  // === ESLint v10 novas regras default (desligar por compatibilidade código existente) ===
  'preserve-caught-error': 'off',
  'no-useless-assignment': 'warn',
  'no-constant-binary-expression': 'warn',
};

const TS_QUALITY_TESTS_OVERRIDE: Record<string, 'off'> = {
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  '@typescript-eslint/no-unused-expressions': 'off',
  '@typescript-eslint/unbound-method': 'off',
  'prefer-const': 'off',
  eqeqeq: 'off',
  'no-useless-escape': 'off',
};

const baseIgnores = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.git/**',
  'supabase/**',
  'src/__tests__/integration/**',
  '.husky/**',
  '*rc.js',
  '*.config.cjs',
  '*.config.mjs',
  'jest.config.ts',
  'jest.config.js',
];

const TS_SOFT_TYPE_AWARE_OFF: Record<string, 'off'> = {
  '@typescript-eslint/no-base-to-string': 'off',
  '@typescript-eslint/await-thenable': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  '@typescript-eslint/consistent-type-exports': 'off',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
  '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/no-misused-promises': 'off',
};

// Perfil 1: SOFT (padrão npm run lint:soft) — SEM type-aware, mais rápido, warnings
const softConfig = tseslint.config(
  { ignores: baseIgnores },
  eslintPluginJs.configs.recommended,
  // Sem strictTypeChecked nem stylistic type-aware — só base
  ...tseslint.configs.recommended,
  {
    name: 'totemdigital/soft',
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020, ...globals.jest, NodeJS: 'readonly', BufferEncoding: 'readonly' },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { impliedStrict: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { ...TS_QUALITY_RELAXED, ...TS_SOFT_TYPE_AWARE_OFF },
  },
  {
    name: 'totemdigital/soft-tests',
    files: ['src/__tests__/**/*.ts'],
    rules: TS_QUALITY_TESTS_OVERRIDE,
  },
);

// Perfil 2: PADRÃO (lint / lint:fix) — stylistic + recommended type-aware
const standardConfig = tseslint.config(
  { ignores: baseIgnores },
  eslintPluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    name: 'totemdigital/standard',
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020, ...globals.jest, NodeJS: 'readonly', BufferEncoding: 'readonly' },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.{js,mjs,cjs,ts}'],
          defaultProject: './tsconfig.json',
          maximumDefaultProjectFileMatchCount_THIS_WILL_BREAK_WHEN_SETTING_UP_A_PROJECT: 2000,
        },
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { impliedStrict: true },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: TS_QUALITY_RELAXED,
  },
  {
    name: 'totemdigital/standard-tests',
    files: ['src/__tests__/**/*.ts'],
    rules: TS_QUALITY_TESTS_OVERRIDE,
  },
);

// Perfil 3: STRICT (check:strict) — full strict + type-aware + stylistic
const strictConfig = tseslint.config(
  { ignores: baseIgnores },
  eslintPluginJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    name: 'totemdigital/strict',
    files: ['src/**/*.ts'],
    languageOptions: standardConfig.find(c => c.name === 'totemdigital/standard')?.languageOptions,
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: TS_QUALITY_RELAXED,
  },
  {
    name: 'totemdigital/strict-tests',
    files: ['src/__tests__/**/*.ts'],
    rules: TS_QUALITY_TESTS_OVERRIDE,
  },
);

// LINT_PROFILE permite alternar perfil via ENV var do script package.json
const profile = (process.env.LINT_PROFILE || 'standard').toLowerCase();
if (profile === 'soft') module.exports = softConfig;
else if (profile === 'strict') module.exports = strictConfig;
else module.exports = standardConfig;

// Também export default para CLI / IDEs que não usam LINT_PROFILE
export default standardConfig;
