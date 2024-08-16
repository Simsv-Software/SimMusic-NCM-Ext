import { writeFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";

const PRODUCTION = true;

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['cjs']
        },
        ssr: true
    },

    plugins: [
        {
            name: 'Manifest Generator',

            buildEnd() {
                writeFileSync('manifest.json', JSON.stringify({
                    name: '网易云 NodeJS API 扩展',
                    url: 'file://' + resolve(__dirname, 'dist', 'index.cjs').replace(/\\/g, '/'),
                    schema: 'ncm',
                    version: '0.0.2-alpha.2+for.0.4',
                    isDev: !PRODUCTION
                }, null, 4));
            }
        }
    ]
});