module.exports = {
    singleQuote: false,
    printWidth: 100,
    tabWidth: 4,
    overrides: [
        {
            files: ["*.yml", "*.yaml"],
            options: {
                tabWidth: 2,
            },
        },
    ],
    plugins: [
        require.resolve("prettier-plugin-organize-imports"),
        require.resolve("prettier-plugin-packagejson"),
        require.resolve("prettier-plugin-tailwindcss"),
    ],
};
