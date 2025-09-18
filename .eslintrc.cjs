module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'node_modules',
    'backups/**/*',
    '**/*.ts',
    '**/*.tsx',
    'supabase/**/*',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console in scripts
    'prefer-const': 'error',
    'no-undef': 'off', // Allow undefined globals in scripts
  },
  overrides: [
    {
      files: ['scripts/**/*.js', 'validate-env.js'],
      rules: {
        'no-unused-vars': 'off', // Allow unused vars in scripts
        'no-console': 'off', // Allow console in scripts
        'no-undef': 'off', // Allow undefined globals in scripts
      },
    },
  ],
}
