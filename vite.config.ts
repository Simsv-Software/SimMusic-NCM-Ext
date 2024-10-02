import { readFileSync, writeFileSync } from 'fs';
import { defineConfig } from 'vite';
import { strToU8, zipSync } from 'fflate';

const VERSION = JSON.parse(readFileSync('package.json').toString()).version;
const SIMMUSIC_VERSION = '0.2.1';

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
            name: 'Post Build Operations',

            buildEnd() {
                if (process.env.GITHUB_CI == 'YES') {
                    writeFileSync(process.env.GITHUB_OUTPUT!!,
                        'EXT_VERSION=' + VERSION + '\nSIMMUSIC_VERSION=' + SIMMUSIC_VERSION + '\n')
                }
            },

            writeBundle(_, bundle) {
                /* Minify again! */
                const indexBundle = bundle['index.cjs'] as any;
                const minified = (indexBundle.code as string)
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .split('\n').filter(it => it != '').map(it => it.trim()).join('\n');

                /* 打包 */
                const manifest = JSON.stringify({
                    extName: '网易云 NodeJS API 支持扩展',
                    uiName: '网易云',
                    entries: ['index.js'],
                    packageId: 'ncm',
                    version: VERSION
                });

                const data = zipSync({
                    'manifest.json': strToU8(manifest),
                    'index.js': strToU8(minified)
                });

                writeFileSync('dist/extension.zip', data);
            }
        }
    ]
});