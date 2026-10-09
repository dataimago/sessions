import { createRequire } from 'node:module';
import fs from 'node:fs';
import type { Config } from 'tailwindcss';

/**
 * `@dataimago/css` ships `./tailwind-preset` (CJS `module.exports`) from a
 * package whose package.json is `"type": "module"`. Node and Turbopack then
 * treat `dist/tailwind-preset.js` as ESM and throw `module is not defined`.
 * Evaluate the published file as CJS so we still consume the real preset.
 */
function loadDataimagoPreset(): Config {
  const require = createRequire(import.meta.url);
  const presetPath = require.resolve('@dataimago/css/tailwind-preset');
  const source = fs.readFileSync(presetPath, 'utf8');
  const cjsModule = { exports: {} as Config };
  const load = new Function('module', 'exports', 'require', source);
  load(cjsModule, cjsModule.exports, require);
  return cjsModule.exports;
}

const config: Config = {
  presets: [loadDataimagoPreset()],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-next-display)', 'Josefin Sans', 'sans-serif'],
        sans: ['var(--font-next-sans)', 'Noto Sans', 'sans-serif'],
        mono: ['var(--font-next-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
