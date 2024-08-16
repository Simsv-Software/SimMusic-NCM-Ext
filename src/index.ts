import { getCache, initCache, makeCache } from './cache';
import { formatLyric } from './lyricpp';

declare const defaultConfig: any;
declare const config: { getItem(key: string): string };
declare const SettingsPage: { data: Array<any> };
declare const ExtensionConfig: any;
declare const ipcRenderer: { invoke(msg: any): void };
declare function showErrorOverlay(err: Error): void;
declare function alert(msg: string, then?: Function): void;

interface Metadata {
    title: string,
    artist: string,
    album: string,
    cover: string,
    time: number,
}

interface PlayUrlCache {
    url: string,
    time: number,
    expi: number
}

// 配置
Object.assign(defaultConfig, {
    'ext.ncm.apiEndpoint': '',
    'ext.ncm.apiHeaders': '',
    'ext.ncm.searchLimit': 30,
    'ext.ncm.filterInvalid': true,
    'ext.ncm.cacheEnabled': true,
    'ext.ncm.maxCacheCount': 50,
    'ext.ncm.formatLrc': true
});

SettingsPage.data.push(
    { type: 'title', text: '网易云 NodeJS API 扩展' },
    { type: 'input', text: 'API 地址', description: '必填，无需最后的斜线（示例： https://api.example.com）。', configItem: 'ext.ncm.apiEndpoint' },
    { type: 'input', text: '要发送给 API 的 Header 信息', description: '选填，支持多个（格式：a=b&c=d，需要 URL 转义）。', configItem: 'ext.ncm.apiHeaders' },
    { type: 'input', inputType: 'number', text: '搜索时每页歌曲数量', description: '必填，默认为 30，推荐不超过 50。', configItem: 'ext.ncm.searchLimit' },
    { type: 'boolean', text: '过滤无效歌曲', description: '开启后搜索结果中将过滤您无法播放的歌曲。', configItem: 'ext.ncm.filterInvalid' },
    { type: 'boolean', text: '启用自动缓存', description: '开启后可提升歌单中网易云曲目的加载速度，但会占用更多内存空间。', configItem: 'ext.ncm.cacheEnabled' },
    { type: 'input', inputType: 'number', text: '最大缓存歌曲数量', description: '必填，默认为 50 首，缓存超出部分会自动删除。', configItem: 'ext.ncm.maxCacheCount' },
    {
        type: 'button', text: '清除缓存数据', description: '点击按钮可立即清除所有网易云歌曲缓存数据。', button: '清除', onclick: () => {
            try {
                initCache();
            } catch {
                localStorage.setItem('ext.ncm.clearCache', '1');
            }

            alert('网易云歌曲缓存已全部清除，点击确定以重载应用。', () => ipcRenderer.invoke("restart"));
        }
    },
    { type: 'boolean', text: '自动格式化歌词', description: '开启后将会自动在网易云歌曲歌词中的无尾随空格英文标点后添加空格，增加 UI 美观度。', configItem: 'ext.ncm.formatLrc' }
);

// 清除上次无法清除的缓存
if (localStorage.getItem('ext.ncm.clearCache') == '1') {
    initCache();
    localStorage.removeItem('ext.ncm.clearCache');
}

// 处理请求部分
async function request(path: string, query: object = {}) {
    const formatted = Object.keys(query).map(k => encodeURI(k) + '=' + encodeURI(query[k])).join('&');

    const headers = {};
    config.getItem('ext.ncm.apiHeaders').split('&').map(it => it.split('=')).forEach(it => {
        headers[decodeURI(it[0])] = decodeURI(it[1]);
    });

    const resp = await fetch(config.getItem('ext.ncm.apiEndpoint') + path + '?' + formatted, { headers });
    return await resp.json();
}

const playableMap: Record<string, boolean> = {};
async function fetchMetadata(...ids: string[]): Promise<Record<string, Metadata>> {
    const result = {};

    const resp = await request('/song/detail', { ids: ids.join(',') });
    resp.privileges.forEach((pri: any) => {
        playableMap[pri.id] = pri.plLevel != 'none';
    });

    resp.songs.forEach((obj: any) => {
        result[obj.id] = {
            title: obj.name,
            artist: obj.ar.map((it: any) => it.name).join(', '),
            album: obj.al.name,
            cover: obj.al.picUrl + '?param=360y360',
            time: obj.dt / 1000
        };
    });

    return result;
}

let cachedMetadata: Record<string, Metadata> = {};
const cachedPlayUrl: Record<string, PlayUrlCache> = {};
const cachedLyrics: Record<string, string> = {};

ExtensionConfig.ncm = {
    uiName: '网易云',

    async readMetadata(path: string) {
        const id = path.substring(/* ncm: */ 4);
        if (cachedMetadata[id]) {
            return cachedMetadata[id];
        }

        return (await fetchMetadata(id))[id];
    },

    player: {
        async getPlayUrl(path: string, count: number = 0) {
            const id = path.substring(/* ncm: */ 4);

            const cached = getCache(id);
            if (cached) {
                return 'file://' + cached;
            }

            if (cachedPlayUrl[id] && (performance.now() - cachedPlayUrl[id].time) / 1000 < (cachedPlayUrl[id].expi - 200)) {
                return cachedPlayUrl[id].url;
            }

            const resp = await request('/song/url', { id, br: 320000 });
            const obj = resp.data[0];
            const url = obj.url;

            // Max 5 retries
            if (url == null && count < 5) {
                return await this.getPlayUrl(path, count + 1);
            }

            if (config.getItem('ext.ncm.cacheEnabled')) {
                makeCache(id, url);
            }

            cachedPlayUrl[id] = {
                url,
                time: performance.now(),
                expi: obj.expi
            };

            return url;
        },

        async getLyrics(path: string) {
            const id = path.substring(/* ncm: */ 4);
            if (cachedLyrics[id]) {
                return cachedLyrics[id];
            }

            const resp = await request('/lyric', { id });
            cachedLyrics[id] = '';

            if (resp.pureMusic || !resp.lrc) {
                return '';
            }

            let lyric = resp.lrc.lyric;
            if (resp.tlyric) {
                lyric += '\n' + resp.tlyric.lyric;
            }

            if (config.getItem('ext.ncm.formatLrc')) {
                lyric = formatLyric(lyric);
            }

            return (cachedLyrics[id] = lyric);
        }
    },

    async search(keywords: string, page: number) {
        if (config.getItem('ext.ncm.apiEndpoint') == '') {
            alert('您还未填写 API 地址，请在设置页面中进行配置。');
            return { files: [] };
        }

        try {
            const resp = await request('/search', {
                keywords,
                limit: config.getItem('ext.ncm.searchLimit'),
                offset: page * Number(config.getItem('ext.ncm.searchLimit'))
            });

            let ids = resp.result.songs.map((it: any) => it.id);
            cachedMetadata = await fetchMetadata(...ids);

            if (config.getItem('ext.ncm.filterInvalid')) {
                ids = ids.filter((it: string) => playableMap[it]);
            }

            return {
                files: ids.map((it: string) => 'ncm:' + it),
                hasMore: resp.result.hasMore
            };
        } catch (err) {
            console.error(err);
            showErrorOverlay(err);
        }
    }
};