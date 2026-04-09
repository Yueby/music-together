# kugou-lrc

[![npm](https://img.shields.io/npm/v/@s4p/kugou-lrc.svg?label=%40s4p%2Fkugou-lrc&style=flat-square)](https://www.npmjs.com/package/@s4p/kugou-lrc)
![build](https://gitlab.com/shang-music/kugou-lrc/badges/develop/build.svg)
![coverage](https://gitlab.com/shang-music/kugou-lrc/badges/develop/coverage.svg)

## how to use

`npm install @s4p/kugou-lrc`

**see [test folder](https://github.com/xinshangshangxin/music/tree/5.x/kugou-lrc/test) to learn more**

### get

```ts
function get(params: { keyword: string; milliseconds: number; fmt: Format.krc }): Promise<KrcInfo>;
function get(params: { keyword: string; milliseconds: number; fmt: Format.lrc }): Promise<LrcInfo>;
function get(params: { hash: string; fmt: Format.krc }): Promise<KrcInfo>;
function get(params: { hash: string; fmt: Format.lrc }): Promise<LrcInfo>;
function get(params: { keyword: string; milliseconds: number }): Promise<KrcInfo>;
function get(params: { hash: string }): Promise<KrcInfo>;

const lrc = await get({
  keyword: '小さな恋のうた',
  milliseconds: 325000,
  fmt: Format.lrc,
});
```

### search

```ts
function search(params: { keyword: string; milliseconds: number }): Promise<KugouLrc[]>;
function search(params: { hash: string }): Promise<KugouLrc[]>;

await search({ keyword: '小さな恋のうた', milliseconds: 325000 });
```

### download

```ts
function download(option: LrcDownloadOption): Promise<string>;

await download({ id, accesskey, fmt: Format.krc });
```

### parse

```ts
function parseKrc(content: string): KrcInfo;
function parseLrc(content: string): LrcInfo;

const krc = await parseKrc(krcStr);
```

## Thanks

[kugou-lyric](https://github.com/kangkang520/kugou-lyric)
[酷狗歌词 API](https://blog.csdn.net/u010752082/article/details/50810190)
