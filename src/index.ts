import { AsyncPool } from './async_pool';
import { getCache, initCache, makeCache } from './cache';
import { formatLyric } from './lyricpp';

declare const defaultConfig: any;
declare const config: { getItem(key: string): any; setItem(key: string, value: any): void };
declare const SettingsPage: { data: Array<any> };
declare const ExtensionConfig: any;
declare const DownloadController: { getMenuItems(): any };
declare const ipcRenderer: { invoke(msg: any): void };
declare function showErrorOverlay(err: Error): void;
declare function switchRightPage(page: string): void;
declare function renderMusicList(files: Array<string>, uniqueId: string, isFinalRender: boolean, dontRenderBeforeLoaded: boolean, errorText: string, menuItems: Array<any>, musicListInfo: any, force?: boolean, finishCallback?: Function): void;
declare function alert(msg: string, then?: Function): void;
declare function confirm(msg: string, then?: Function): void;
declare function prompt(placeholder: string, then: (str: string) => void): void;
declare class ContextMenu { constructor(menus: Array<any>); popup(pos: Array<number>): void };

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

interface MusicListEntry {
    id: string,
    name: string,
    songs: Record<string, Metadata>
}

// 配置
Object.assign(defaultConfig, {
    'ext.ncm.apiEndpoint': '',
    'ext.ncm.apiHeaders': '',
    'ext.ncm.searchLimit': 30,
    'ext.ncm.filterInvalid': true,
    'ext.ncm.cacheEnabled': true,
    'ext.ncm.maxCacheCount': 50,
    'ext.ncm.formatLrc': true,

    // Internal Data
    'ext.ncm.musicList': []
});

SettingsPage.data.push(
    { type: 'title', text: '网易云 NodeJS API 扩展' },
    { type: 'input', text: 'API 地址', description: '必填，无需最后的斜线（示例： https://api.example.com）。', configItem: 'ext.ncm.apiEndpoint' },
    { type: 'input', text: '要发送给 API 的 Header 信息', description: '选填，支持多个（格式：a=b&c=d，需要 URL 转义）。', configItem: 'ext.ncm.apiHeaders' },
    { type: 'input', inputType: 'number', text: '搜索时每页歌曲数量', description: '必填，默认为 30，推荐不超过 50，不能超过 100。', configItem: 'ext.ncm.searchLimit' },
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

// 分割数组
function splitArray<T>(arr: T[], chunkSize: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }

    return result;
}

const playableMap: Record<string, boolean> = {};
async function fetchMetadata(...ids: string[]): Promise<Record<string, Metadata>> {
    const result = {};

    const split = splitArray(ids, 100);
    const pool = new AsyncPool(split.length);
    for (let idsArr of split) {
        pool.submit(async () => {
            const resp = await request('/song/detail', { ids: idsArr.join(',') });
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
        });
    }

    pool.shutdown();
    await pool.completion;

    return result;
}

let cachedMetadata: Record<string, Metadata> = {};
const cachedPlayUrl: Record<string, PlayUrlCache> = {};
const cachedLyrics: Record<string, string> = {};
const elements: Record<string, HTMLDivElement> = {};

ExtensionConfig.ncm = {
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
                limit: Math.min(Number(config.getItem('ext.ncm.searchLimit')), 100),
                offset: page * Number(config.getItem('ext.ncm.searchLimit'))
            });

            let ids = resp.result.songs.map((it: any) => it.id);
            cachedMetadata = await fetchMetadata(...ids);

            if (config.getItem('ext.ncm.filterInvalid')) {
                ids = ids.filter((it: string) => playableMap[it]);
            }

            return {
                files: ids.map((it: string) => 'ncm:' + it),
                hasMore: resp.result.hasMore,
                menu: [DownloadController.getMenuItems()]
            };
        } catch (err) {
            console.error(err);
            showErrorOverlay(err);
        }
    },

    musicList: {
        async _import(callback: Function, id: string, isUpdate: boolean = false) {
            let list: Array<MusicListEntry> = config.getItem('ext.ncm.musicList');
            if (!isUpdate) {
                for (let entry of list) {
                    if (entry.id == id) {
                        return alert('此歌单（' + entry.name + '）已被添加，请尝试删除后重试。')
                    }
                }
            }

            // 解析歌单
            try {
                const resp = await request('/playlist/detail', { id });
                const name = resp.playlist.name;
                let ids = resp.playlist.tracks.map((it: any) => it.id);
                let filtered = 0;

                if (config.getItem('ext.ncm.filterInvalid')) {
                    const len = ids.length;

                    resp.privileges.forEach((it: any) => {
                        playableMap[it.id] = it.plLevel != 'none';
                    });

                    ids = ids.filter((it: string) => playableMap[it]);
                    filtered = len - ids.length;
                }

                const metadata = await fetchMetadata(...ids);
                if (Object.keys(metadata).length != ids.length) {
                    throw '获取歌曲元数据时发生错误。';
                }

                if (isUpdate) {
                    list = list.filter(it => it.id != id);
                }

                const newEntry: MusicListEntry = { id, name, songs: metadata };
                list.push(newEntry);

                config.setItem('ext.ncm.musicList', list);

                if (isUpdate) {
                    ExtensionConfig.ncm.musicList.switchList(id);
                }

                alert('成功导入歌单 ' + name + '，共导入 ' + ids.length + ' 首歌曲' + (filtered ? '，' + filtered + ' 首因无法播放被过滤' : '') + '。', callback);
            } catch (err) {
                alert('导入歌单失败，请稍后重试：' + err);
            }
        },

        add(callback: Function) {
            prompt('请输入网易云歌单 分享 URL 或 ID 以导入歌单', async input => {
                let id: string;

                try {
                    // 如果输入是 ID
                    if (/^\d+$/.test(input)) {
                        id = input;
                    } else if (input.includes('id=')) {
                        // 解析字符串
                        if (!input.startsWith('https://')) {
                            const matches = input.match(/https:\/\/(?:[a-zA-Z0-9\-\.]+\.)?music\.163\.com\/[\w\-\/?=&#]+/g);
                            if (!matches || !matches.length) {
                                throw 0;
                            }

                            input = matches[0];
                        }

                        const param = new URL(input).searchParams.get('id');
                        if (!param || !/^\d+$/.test(param)) {
                            throw 0;
                        }

                        id = param;
                    } else {
                        throw 0;
                    }
                } catch {
                    return alert('无法解析歌曲 ID，请检查您输入的内容。');
                }

                await ExtensionConfig.ncm.musicList._import(callback, id);
            });
        },

        renderList(container: HTMLElement) {
            const list: Array<MusicListEntry> = config.getItem('ext.ncm.musicList');
            list.forEach(entry => {
                const element = document.createElement('div');
                element.textContent = entry.name;

                element.onclick = () => this.switchList(entry.id);
                element.oncontextmenu = event => {
                    new ContextMenu([
                        { label: '查看歌曲', click: element.click },
                        {
                            label: '重新导入歌单', click() {
                                confirm(`确认重新导入网易云歌单 ${entry.name} 吗？`, () => {
                                    ExtensionConfig.ncm.musicList._import(null, entry.id, true);
                                });
                            }
                        },
                        {
                            label: '从列表中移除', click() {
                                confirm(`确认移除网易云歌单 ${entry.name} 吗？`, () => {
                                    const currentList: Array<MusicListEntry> = config.getItem('ext.ncm.musicList');
                                    console.log(currentList.filter(it => it.id != entry.id));
                                    config.setItem('ext.ncm.musicList', currentList.filter(it => it.id != entry.id));

                                    if (element.classList.contains('active')) {
                                        switchRightPage('rightPlaceholder');
                                    }

                                    delete elements[entry.id];
                                    element.remove();
                                });
                            }
                        }
                    ]).popup([event.clientX, event.clientY]);
                };

                elements[entry.id] = element;
                container.appendChild(element);
            });
        },

        switchList(id: string) {
            const entry: MusicListEntry = (config.getItem('ext.ncm.musicList') as Array<MusicListEntry>).find(it => it.id == id)!!;
            Object.assign(cachedMetadata, entry.songs);

            renderMusicList(Object.keys(entry.songs).map(it => 'ncm:' + it), 'ncm-list-' + id, false, false, '该歌单为空', [DownloadController.getMenuItems()], { name: entry.name });

            document.querySelectorAll(".left .leftBar div").forEach(it => {
                if (it.classList.contains('active')) {
                    it.classList.remove('active');
                }
            })

            elements[id].classList.add('active');
        }
    }
};