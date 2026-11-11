import Meting from '@meting/core'
import type { MusicSource, Playlist } from '@music-together/shared'
import { httpsCoverUrl } from '../utils/httpsCoverUrl.js'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import { deriveThumbnailCoverUrl, normalizeKugouTemplateCoverUrl, normalizeNeteaseCoverUrl } from './coverUrls.js'

/**
 * Album and playlist search for the three platforms. Both answer with `Playlist` entries (an album is a playlist-shaped
 * list whose tracks are read with `type: 'album'`). A search that fails or times out answers an empty list: the user
 * sees "no results" and can try again, and the failure is logged.
 */

const API_TIMEOUT_MS = 15_000
const QQ_ENDPOINT = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
const QQ_SEARCH_KEY = 'music.search.SearchCgiService.DoSearchForQQMusicDesktop'
const QQ_ALBUM = 2
const QQ_PLAYLIST = 3
const NETEASE_ALBUM = 10
const NETEASE_PLAYLIST = 1000

// The upstream answers are loosely typed JSON; each mapper reads only the fields it needs.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>

/** One QQ desktop search of `searchType`; `null` when the request fails, times out or is refused. */
async function qqSearch(searchType: number, keyword: string, limit: number, page: number): Promise<Raw | null> {
  const payload = {
    comm: { ct: '6', cv: '80600', tmeAppID: 'qqmusic' },
    [QQ_SEARCH_KEY]: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: { num_per_page: limit, page_num: page, search_type: searchType, query: keyword, grp: 1 },
    },
  }
  const response = await withTimeoutOrNull(async (signal) => {
    const res = await fetch(QQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://y.qq.com',
        'User-Agent': 'QQ%E9%9F%B3%E4%B9%90/73222',
      },
      body: JSON.stringify(payload),
      signal,
    })
    return res.ok ? ((await res.json()) as Raw) : null
  }, API_TIMEOUT_MS)
  const result = response?.[QQ_SEARCH_KEY]
  return result?.code === 0 ? (result.data?.body ?? null) : null
}

/** One Kugou mobile search (`album` or `special` = playlist); the list of hits, or `null`. */
async function kugouSearch(
  kind: 'album' | 'special',
  keyword: string,
  limit: number,
  page: number,
): Promise<Raw[] | null> {
  const url =
    `http://mobilecdn.kugou.com/api/v3/search/${kind}?api_ver=1&area_code=1&correct=1&pagesize=${limit}` +
    `&plat=2&tag=1&sver=5&showtype=10&page=${page}&keyword=${encodeURIComponent(keyword)}&version=8990`
  const response = await withTimeoutOrNull(async (signal) => {
    const res = await fetch(url, { signal })
    return res.ok ? ((await res.json()) as Raw) : null
  }, API_TIMEOUT_MS)
  return response?.errcode === 0 && Array.isArray(response.data?.info) ? response.data.info : null
}

/** One NetEase search through Meting's raw mode (its formatter expects songs); the parsed answer, or `null`. */
async function neteaseSearch(type: number, keyword: string, limit: number, page: number): Promise<Raw | null> {
  const meting = new Meting('netease')
  meting.format(false)
  const raw = await withTimeoutOrNull(meting.search(keyword, { limit, page, type } as never), API_TIMEOUT_MS)
  if (!raw) return null
  try {
    return JSON.parse(raw as string) as Raw
  } catch {
    return null
  }
}

function album(
  source: MusicSource,
  fields: { id: unknown; name: unknown; cover: string; thumbnail: string; trackCount: unknown; creator: unknown },
): Playlist {
  return {
    id: String(fields.id),
    name: String(fields.name || 'Unknown Album'),
    cover: fields.cover,
    thumbnailCover: fields.thumbnail,
    trackCount: Number(fields.trackCount) || 0,
    source,
    creator: String(fields.creator || ''),
  }
}

function playlist(
  source: MusicSource,
  fields: {
    id: unknown
    name: unknown
    cover: string
    thumbnail: string
    trackCount: unknown
    creator: unknown
    description: unknown
  },
): Playlist {
  return {
    ...album(source, { ...fields, name: fields.name || 'Unknown Playlist' }),
    description: String(fields.description || ''),
  }
}

export async function searchAlbums(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Playlist[]> {
  if (!keyword.trim()) return []
  try {
    if (source === 'tencent') {
      const list = (await qqSearch(QQ_ALBUM, keyword, limit, page))?.album?.list
      if (!Array.isArray(list)) return []
      return list.map((hit: Raw) => {
        const cover = httpsCoverUrl(hit.albumPic || '')
        return album('tencent', {
          id: hit.albumMID || hit.albumID,
          name: hit.albumName,
          cover,
          thumbnail: deriveThumbnailCoverUrl('tencent', cover),
          trackCount: hit.song_count,
          creator: hit.singerName,
        })
      })
    }

    if (source === 'kugou') {
      const list = await kugouSearch('album', keyword, limit, page)
      return (list ?? []).map((hit) =>
        album('kugou', {
          id: hit.albumid,
          name: hit.albumname,
          cover: normalizeKugouTemplateCoverUrl(hit.imgurl || ''),
          thumbnail: deriveThumbnailCoverUrl('kugou', hit.imgurl || ''),
          trackCount: hit.songcount,
          creator: hit.singername,
        }),
      )
    }

    const albums = (await neteaseSearch(NETEASE_ALBUM, keyword, limit, page))?.result?.albums
    if (!Array.isArray(albums)) return []
    return albums.map((hit: Raw) => {
      const cover = normalizeNeteaseCoverUrl(hit.picUrl || hit.blurPicUrl || '')
      return album('netease', {
        id: hit.id,
        name: hit.name,
        cover,
        thumbnail: deriveThumbnailCoverUrl('netease', cover),
        trackCount: hit.size,
        creator: hit.artist?.name,
      })
    })
  } catch (error) {
    logger.error(`Search album failed for ${source}:`, error)
    return []
  }
}

export async function searchPlaylists(source: MusicSource, keyword: string, limit = 20, page = 1): Promise<Playlist[]> {
  if (!keyword.trim()) return []
  try {
    if (source === 'tencent') {
      const list = (await qqSearch(QQ_PLAYLIST, keyword, limit, page))?.songlist?.list
      if (!Array.isArray(list)) return []
      return list.map((hit: Raw) => {
        const cover = httpsCoverUrl(hit.imgurl || '')
        return playlist('tencent', {
          id: hit.dissid,
          name: hit.dissname,
          cover,
          thumbnail: deriveThumbnailCoverUrl('tencent', cover),
          trackCount: hit.song_count,
          creator: hit.creator?.name,
          description: hit.introduction,
        })
      })
    }

    if (source === 'kugou') {
      const list = await kugouSearch('special', keyword, limit, page)
      return (list ?? []).map((hit) =>
        playlist('kugou', {
          id: hit.specialid,
          name: hit.specialname,
          cover: normalizeKugouTemplateCoverUrl(hit.imgurl || ''),
          thumbnail: deriveThumbnailCoverUrl('kugou', hit.imgurl || ''),
          trackCount: hit.songcount,
          creator: hit.nickname,
          description: hit.intro,
        }),
      )
    }

    const playlists = (await neteaseSearch(NETEASE_PLAYLIST, keyword, limit, page))?.result?.playlists
    if (!Array.isArray(playlists)) return []
    return playlists.map((hit: Raw) => {
      const cover = normalizeNeteaseCoverUrl(hit.coverImgUrl || hit.picUrl || '')
      return playlist('netease', {
        id: hit.id,
        name: hit.name,
        cover,
        thumbnail: deriveThumbnailCoverUrl('netease', cover),
        trackCount: hit.trackCount,
        creator: hit.creator?.nickname,
        description: hit.description,
      })
    })
  } catch (error) {
    logger.error(`Search playlist failed for ${source}:`, error)
    return []
  }
}
