import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tests/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      'no-unused-vars': 'off',

      'no-console': 'off',
      'no-restricted-globals': [
        'error',
        {
          name: 'console',
          message: 'Do not use console.* directly. Use the logger instead.'
        }
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false
        }
      ]
    }
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/services/**',
                '@/models/**',
                '@/app/**',
                '@/utils/discord/**'
              ]
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/app/commands/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services/db/**', '@/models/**']
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/services/**/*.{ts,tsx}', 'src/scripts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    files: ['src/utils/logger.ts'],
    rules: {
      'no-restricted-globals': 'off'
    }
  }
]
