const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/server/src/services/musicProvider.ts');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  /async getPlaylistPage\(\s*source: MusicSource,\s*playlistId: string,\s*limit: number,\s*offset: number,\s*playlistTotal\?: number,\s*cookie\?: string \| null,\s*\)/,
  `async getPlaylistPage(
    source: MusicSource,
    playlistId: string,
    limit: number,
    offset: number,
    playlistTotal?: number,
    cookie?: string | null,
    type: 'playlist' | 'album' = 'playlist'
  )`
);

content = content.replace(
  /const { ids, total } = await this.fetchFullPlaylist\(source, playlistId, playlistTotal, cookie\)/g,
  `const { ids, total } = await this.fetchFullPlaylist(source, playlistId, playlistTotal, cookie, type)`
);

content = content.replace(
  /async fetchFullPlaylist\(\s*source: MusicSource,\s*playlistId: string,\s*playlistTotal\?: number,\s*cookie\?: string \| null,\s*\)/,
  `async fetchFullPlaylist(
    source: MusicSource,
    playlistId: string,
    playlistTotal?: number,
    cookie?: string | null,
    type: 'playlist' | 'album' = 'playlist'
  )`
);

content = content.replace(
  /if \(source === 'netease'\) \{\s*return this.fetchNeteasePlaylist\(playlistId, cacheKey, playlistTotal, cookie\)\s*\}/,
  `if (source === 'netease') {
      if (type === 'album') {
        return this.fetchNeteaseAlbum(playlistId, cacheKey)
      }
      return this.fetchNeteasePlaylist(playlistId, cacheKey, playlistTotal, cookie)
    }`
);

content = content.replace(
  /return this.fetchMetingPlaylist\(source, playlistId, cacheKey\)/,
  `return this.fetchMetingPlaylist(source, playlistId, cacheKey, type)`
);

const fetchMetingPlaylistMatch = /async fetchMetingPlaylist\([\s\S]*?cacheKey: string,\s*\)/.exec(content);
if (fetchMetingPlaylistMatch) {
  content = content.replace(fetchMetingPlaylistMatch[0], 
  `async fetchMetingPlaylist(
    source: MusicSource,
    playlistId: string,
    cacheKey: string,
    type: 'playlist' | 'album' = 'playlist'
  )`);
}

content = content.replace(
  /const raw = await withTimeout\(meting.playlist\(playlistId\), 30_000\)/,
  `const raw = await withTimeout(type === 'album' ? meting.album(playlistId) : meting.playlist(playlistId), 30_000)`
);

content = content.replace(
  /const songs = this.navigatePath\(rawData, PLAYLIST_PATHS\[source\]\)/,
  `// For Tencent album, the path is data.getSongInfo, for Kugou it's data.info
      let path = PLAYLIST_PATHS[source]
      if (type === 'album') {
        if (source === 'tencent') path = 'data.getSongInfo'
        if (source === 'kugou') path = 'data.info'
      }
      const songs = this.navigatePath(rawData, path)`
);

const fetchNeteaseAlbumFn = `
  /** Fetch Netease album using ncmApi.album */
  private async fetchNeteaseAlbum(
    albumId: string,
    cacheKey: string,
  ): Promise<{ ids: string[]; total: number }> {
    try {
      const res = await withTimeout(ncmApi.album({ id: albumId, timestamp: Date.now() }), 30_000)
      if (res === null) {
        logger.warn(\`Netease album timeout: \${albumId}\`)
        return { ids: [], total: 0 }
      }

      const songs = res?.body?.songs
      if (!Array.isArray(songs) || songs.length === 0) {
        return { ids: [], total: 0 }
      }

      const allTracks = songs.map((song: any) => this.rawToTrack(song, 'netease'))
      
      for (const t of allTracks) this.enrichFromRegistry(t)
      this.registerTracks(allTracks)

      const ids = allTracks.map((t) => t.sourceId)
      this.playlistIndex.set(cacheKey, { source: 'netease', ids })

      logger.info(\`Netease album \${albumId}: \${ids.length} tracks\`)
      return { ids, total: ids.length }
    } catch (err) {
      logger.error(\`Netease album failed: \${albumId}\`, err)
      return { ids: [], total: 0 }
    }
  }
`;

const insertIndex = content.indexOf('private async fetchNeteasePlaylist');
content = content.substring(0, insertIndex) + fetchNeteaseAlbumFn + '\n  ' + content.substring(insertIndex);

fs.writeFileSync(filePath, content);
console.log('Patched getPlaylistPage and fetchFullPlaylist');
