import { tmpdir } from 'os';
import { resolve, join } from 'path';
import * as fs from 'fs';

declare const config: { getItem(key: string): string };

interface CacheEntry {
    id: string,
    addTime: number
}

let cacheIndex: Array<CacheEntry>;
const cacheDir = resolve(tmpdir(), 'sim-music.ext.ncm', 'cache');
const cacheIndexPath = join(cacheDir, 'index.json');
const caching: Array<string> = [];

if (fs.existsSync(cacheIndexPath)) {
    cacheIndex = JSON.parse(fs.readFileSync(cacheIndexPath).toString());
} else {
    initCache();
}

function mkCacheDir(): void {
    if (fs.existsSync(cacheDir)) {
        return;
    }

    fs.mkdirSync(cacheDir, { recursive: true });
}

function saveIndex(): void {
    fs.writeFileSync(cacheIndexPath, JSON.stringify(cacheIndex));
}

function purgeExceeded(): void {
    const removeNum = cacheIndex.length - Number(config.getItem('ext.ncm.maxCacheCount'))
    if (removeNum <= 0) {
        return;
    }

    cacheIndex.sort((a, b) => a.addTime == b.addTime ? 0 : a.addTime > b.addTime ? 1 : -1);
    cacheIndex.slice(0, removeNum).map(it => it.id).forEach(id => {
        fs.rmSync(join(cacheDir, id + '.cache'));
        console.log('Purged cache for NCM song ' + id);
    });
}

export function initCache(): void {
    if (fs.existsSync(cacheDir)) {
        (function rm(where: string) {
            for (let sub of fs.readdirSync(where)) {
                const path = join(where, sub);
                const stat = fs.statSync(path);

                if (stat.isDirectory()) {
                    rm(path);
                    return fs.rmdirSync(path);
                }

                fs.rmSync(path);
            }
        })(cacheDir);
    }

    cacheIndex = [];
}

export async function makeCache(id: string, url: string) {
    if (caching.includes(id)) {
        return;
    }

    mkCacheDir();

    const cachePath = join(cacheDir, id + '.cache');
    let lastErr: Error | null = null;
    
    for (let i = 0; i < 3; i++) {
        try {
            const resp = await fetch(url);
            const dataBuffer = new Uint8Array(await resp.arrayBuffer());
            fs.writeFileSync(cachePath, dataBuffer);

            break;
        } catch (err) {
            lastErr = err;
        }
    }

    if (lastErr) {
        console.error('Failed to make cache for NCM song id ' + id + ', we will try it again later:', lastErr);
        return;
    }

    cacheIndex.push({ id, addTime: Date.now() });
    purgeExceeded();
    saveIndex();

    console.log('Successfully cached NCM song ' + id);
}

export function getCache(id: string): string | null {
    if (!cacheIndex.some(it => it.id == id)) {
        return null;
    }

    const path = join(cacheDir, id + '.cache');
    return fs.existsSync(path) ? path : null;
}