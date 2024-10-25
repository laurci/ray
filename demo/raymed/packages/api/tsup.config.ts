import { defineConfig } from "tsup";

const packageJson = require("./package.json");

const excludeFromBundle = ["sharp"];
const excludeFromBundlePattern = /\@aws-sdk\//;

const include = Object.keys(packageJson.dependencies).filter(
    (dep) => !excludeFromBundle.includes(dep) && !dep.match(excludeFromBundlePattern),
);
const exclude = Object.keys(packageJson.dependencies).filter((dep) => !include.includes(dep));

const bundleProd = process.env.BUNDLE_PROD === "true";

export default defineConfig({
    entry: ["./src/main.ts"],
    outDir: "./dist",
    format: "esm",
    outExtension: () => ({ js: ".mjs" }),
    clean: true,
    target: "es2022",
    bundle: true,
    sourcemap: true,
    treeshake: true,
    shims: true,
    external: bundleProd ? exclude : undefined,
    noExternal: bundleProd ? include : undefined,
    esbuildOptions: (options) => {
        options.banner ??= {};
        options.banner.js = `import { createRequire as __createRequire__ } from 'module'; const require = __createRequire__(import.meta.url);`;
    },
});
