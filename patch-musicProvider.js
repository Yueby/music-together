const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/server/src/services/musicProvider.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const searchAlbumMethod = `
  /**
   * Search for albums. Returns a list of Playlist objects.
   */
  async searchAlbum(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<import('@music-together/shared').Playlist[]> {
    if (!keyword.trim()) return []

    try {
      if (source === 'tencent') {
        const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
        const payload = {
          comm: { ct: '6', cv: '80600', tmeAppID: 'qqmusic' },
          'music.search.SearchCgiService.DoSearchForQQMusicDesktop': {
            module: 'music.search.SearchCgiService',
            method: 'DoSearchForQQMusicDesktop',
            param: { num_per_page: limit, page_num: page, search_type: 8, query: keyword, grp: 1 },
          },
        }

        const response = await withTimeout(
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Referer: 'https://y.qq.com',
              'User-Agent': 'QQ%E9%9F%B3%E4%B9%90/73222',
            },
            body: JSON.stringify(payload),
          }).then((res) => res.json())
        )

        if (!response) return []

        const result = response['music.search.SearchCgiService.DoSearchForQQMusicDesktop']
        if (result?.code !== 0 || !result?.data?.body?.album?.list) return []

        return result.data.body.album.list.map((album: any) => ({
          id: String(album.albumMID || album.albumID),
          name: album.albumName || 'Unknown Album',
          cover: album.albumPic || '',
          trackCount: album.song_count || 0,
          source: 'tencent',
          creator: album.singerName || '',
        }))
      }

      if (source === 'kugou') {
        const url = \`http://mobilecdn.kugou.com/api/v3/search/album?api_ver=1&area_code=1&correct=1&pagesize=\${limit}&plat=2&tag=1&sver=5&showtype=10&page=\${page}&keyword=\${encodeURIComponent(keyword)}&version=8990\`
        const response = await withTimeout(fetch(url).then(res => res.json()))
        
        if (!response || response.errcode !== 0 || !response.data?.info) return []
        
        return response.data.info.map((album: any) => ({
          id: String(album.albumid),
          name: album.albumname || 'Unknown Album',
          cover: (album.imgurl || '').replace('{size}', '400'),
          trackCount: album.songcount || 0,
          source: 'kugou',
          creator: album.singername || '',
        }))
      }

      if (source === 'netease') {
        const meting = new Meting('netease')
        meting.format(false) // Important: don't format because format expects songs
        const raw = await withTimeout(meting.search(keyword, { limit, page, type: 10 } as any))
        if (!raw) return []

        let data: any
        try {
          data = JSON.parse(raw as string)
        } catch {
          return []
        }

        const albums = data?.result?.albums
        if (!Array.isArray(albums)) return []

        return albums.map((album: any) => ({
          id: String(album.id),
          name: album.name || 'Unknown Album',
          cover: album.picUrl || album.blurPicUrl || '',
          trackCount: album.size || 0,
          source: 'netease',
          creator: album.artist?.name || '',
        }))
      }

      return []
    } catch (err) {
      logger.error(\`Search album failed for \${source}:\`, err)
      return []
    }
  }
`;

const insertIndex = content.indexOf('async search(');
content = content.substring(0, insertIndex) + searchAlbumMethod + '\n  ' + content.substring(insertIndex);

fs.writeFileSync(filePath, content);
console.log('Patched musicProvider.ts');
