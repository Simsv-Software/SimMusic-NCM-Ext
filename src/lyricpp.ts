/* Lyric PreProcessor */
const regexpCache: Record<string, RegExp> = {};

[[',', ','], ['?', '\\?'], ['!', '!']].forEach(it => {
    regexpCache[it[0]] = new RegExp(it[1] + '(?![\\s' + it[1] +'])', 'g');
});

export function formatLyric(input: string): string {
    Object.keys(regexpCache).forEach(it => {
        input = input.replace(regexpCache[it], it + ' ');
    });

    return input.replace(/(?<!\d)\.(?!\d\s)/g, '. ');
}