export default {
  plugins: ['@trivago/prettier-plugin-sort-imports'],

  importOrder: ['^node:', '^discord\\.js', '^commandkit', '^@/.*', '^[./]'],

  importOrderSeparation: true,
  importOrderSortSpecifiers: true,

  singleQuote: true,
  semi: false,

  trailingComma: 'none',

  printWidth: 80,
  tabWidth: 2,
  arrowParens: 'always',
  bracketSpacing: true
}
