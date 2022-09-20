/**
 * eslint config
 * @ref http://eslint.cn/
 * @desc generated at 9/15/2022, 12:51:49 PM by streakingman-cli@1.9.2
 */

module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 11,
    },
    env: {
        es6: true,
        node: true,
    },
    plugins: ['eslint-plugin-prettier', '@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    rules: {
        'prettier/prettier': 'error',
    },
};
