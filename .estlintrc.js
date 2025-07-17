module.exports = {
    root: true,
    extends: [
        '@react-native-community',
        '@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: {
        'react-hooks/exhaustive-deps': 'warn',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'react-native/no-inline-styles': 'off',
        'react-native/no-color-literals': 'off',
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
};
