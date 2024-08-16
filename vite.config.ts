import { writeFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";

const VERSION = '0.0.3-alpha.1+for.0.4';
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
            name: 'Post Build Operations',

            buildEnd() {
                writeFileSync('manifest.json', JSON.stringify({
                    name: '网易云 NodeJS API 扩展',
                    url: 'file://' + resolve(__dirname, 'dist/index.cjs').replace(/\\/g, '/'),
                    schema: 'ncm',
                    version: VERSION,
                    isDev: !PRODUCTION
                }, null, 4));
            },

            async writeBundle(_, bundle) {
                /* Minify again! */
                const indexBundle = bundle['index.cjs'] as any;
                const minified = (indexBundle.code as string)
                    .split('\n').map(it => it.trim()).join('');

                writeFileSync('dist/index.cjs', minified);

                /* 自动推送 API */
                if (process.env.GITHUB_CI_BUILD == 'YES') {
                    await fetch(process.env.SECRET_UPLOAD_URL as string, {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: 'key=' + encodeURI(process.env.SECRET_KEY as string) + '&version=' + encodeURIComponent(VERSION) + '&code=' + encodeURIComponent(minified)
                    });

                    console.log('* Successfully uploaded artifact to the api.');
                }
            }
        }
    ]
});