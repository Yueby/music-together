import Meting from '@meting/core'
import {
  UNKNOWN_ARTIST,
  type Artist,
  type MusicRefKind,
  type MusicSource,
  type Playlist,
  type Track,
} from '@music-together/shared'
import { nanoid } from 'nanoid'
import { logger } from '../utils/logger.js'
import { withTimeoutOrNull } from '../utils/withTimeout.js'
import { artistService, ArtistError } from './artistService.js'
import { SearchError } from './catalogUtils.js'
import { deriveThumbnailCoverUrl, normalizeKugouTemplateCoverUrl, normalizeNeteaseCoverUrl } from './coverUrls.js'
import { musicProvider } from './musicProvider.js'
import { rawToTrack } from './trackMapping.js'

/**
 * Finding one song, album, playlist or artist by its id. The id is already validated (see `normalizeMusicId`); what comes
 * back has the same shape as a search result, so the dialog shows it like one. Nothing found is an empty list; a platform
 * that does not answer is a `SearchError`, like any other search.
 *
 * Kugou's album and playlist answers carry songs only, so those two take their name and cover from what is in them.
 */

const LOOKUP_TIMEOUT_MS = 15_000

// The upstream answers are loosely typed JSON; each mapper reads only the fields it needs.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>

type MetingCall = 'song' | 'album' | 'playlist'

/** One raw Meting answer, parsed. `null` when it is not JSON (the platform answered with something else). */
async function raw(source: MusicSource, call: MetingCall, id: string): Promise<Raw | null> {
  const meting = new Meting(source)
  meting.format(false)
  const text = await withTimeoutOrNull(meting[call](id) as Promise<string>, LOOKUP_TIMEOUT_MS)
  if (text === null) throw new SearchError()
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Raw) : null
  } catch {
    return null
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const count = (value: unknown): number => Number(value) || 0

function playlistEntry(
  source: MusicSource,
  fields: { id: string; name: string; cover: string; trackCount: unknown; creator?: unknown; description?: unknown },
): Playlist {
  return {
    id: fields.id,
    name: fields.name,
    cover: fields.cover,
    thumbnailCover: fields.cover ? deriveThumbnailCoverUrl(source, fields.cover) : '',
    trackCount: count(fields.trackCount),
    source,
    creator: text(fields.creator),
    ...(fields.description ? { description: text(fields.description) } : {}),
  }
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

async function neteaseSong(id: string): Promise<Track[]> {
  const body = await raw('netease', 'song', id)
  return musicProvider.ingestNeteaseSongs(body?.songs)
}

async function tencentSong(id: string): Promise<Track[]> {
  const song = (await raw('tencent', 'song', id))?.data?.[0]
  if (!song || typeof song !== 'object' || !song.mid) return []
  return musicProvider.ingest([rawToTrack(song, 'tencent')])
}

async function kugouSong(hash: string): Promise<Track[]> {
  const song = await raw('kugou', 'song', hash)
  if (!song || song.errcode !== 0 || !song.hash) return []
  const artists = text(song.author_name)
    .split(/[、,，&]/)
    .map((name) => name.trim())
    .filter(Boolean)
  const cover = text(song.album_img || song.imgUrl)
  const track: Track = {
    id: nanoid(),
    source: 'kugou',
    sourceId: String(song.hash),
    title: text(song.songName) || text(song.fileName) || 'Unknown',
    artist: artists.length ? artists : [UNKNOWN_ARTIST],
    album: '',
    // Songs that need a membership report no length here; the player learns it from the audio itself.
    duration: count(song.timeLength),
    cover: cover ? normalizeKugouTemplateCoverUrl(cover) : '',
    urlId: String(song.hash),
    lyricId: String(song.hash),
    picId: String(song.hash),
    vip: count(song.privilege) > 0 || count(song.pay_type) > 0,
  }
  return musicProvider.ingest([track])
}

// ---------------------------------------------------------------------------
// Albums and playlists
// ---------------------------------------------------------------------------

async function neteaseAlbum(id: string): Promise<Playlist[]> {
  const album = (await raw('netease', 'album', id))?.album
  if (!album?.name) return []
  return [
    playlistEntry('netease', {
      id,
      name: album.name,
      cover: normalizeNeteaseCoverUrl(text(album.picUrl)),
      trackCount: album.size,
      creator: album.artist?.name,
    }),
  ]
}

async function tencentAlbum(id: string): Promise<Playlist[]> {
  const data = (await raw('tencent', 'album', id))?.data
  const info = data?.getAlbumInfo
  if (!info?.Falbum_name) return []
  const mid = text(info.Falbum_mid) || id
  return [
    playlistEntry('tencent', {
      id: mid,
      name: info.Falbum_name,
      cover: `https://y.gtimg.cn/music/photo_new/T002R800x800M000${mid}.jpg`,
      trackCount: Array.isArray(data.getSongInfo) ? data.getSongInfo.length : 0,
      creator: info.Fsinger_name ?? info.Fsingername ?? data.getSongInfo?.[0]?.singer?.[0]?.name,
    }),
  ]
}

async function tencentPlaylist(id: string): Promise<Playlist[]> {
  const list = (await raw('tencent', 'playlist', id))?.data?.cdlist?.[0]
  if (!list?.dissname) return []
  const cover = text(list.dir_pic_url2 || list.logo)
  return [
    playlistEntry('tencent', {
      id: text(list.disstid) || id,
      name: list.dissname,
      cover: cover.replace(/^http:\/\//, 'https://'),
      trackCount: list.songnum ?? list.cur_song_num,
      creator: list.nickname ?? list.nick,
      description: list.desc,
    }),
  ]
}

async function neteasePlaylist(id: string): Promise<Playlist[]> {
  const playlist = (await raw('netease', 'playlist', id))?.playlist
  if (!playlist?.name) return []
  return [
    playlistEntry('netease', {
      id,
      name: playlist.name,
      cover: normalizeNeteaseCoverUrl(text(playlist.coverImgUrl)),
      trackCount: playlist.trackCount,
      creator: playlist.creator?.nickname,
      description: playlist.description,
    }),
  ]
}

/** Kugou answers a list with its songs only: name it after the album the songs share, or by its id. */
async function kugouList(call: 'album' | 'playlist', id: string): Promise<Playlist[]> {
  const data = (await raw('kugou', call, id))?.data
  const songs: Raw[] = Array.isArray(data?.info) ? data.info : []
  if (songs.length === 0) return []
  const first = songs[0]
  const cover = text(first.trans_param?.union_cover || first.album_sizable_cover)
  return [
    playlistEntry('kugou', {
      id,
      name:
        (call === 'album' ? text(first.album_name || first.remark) : '') ||
        (call === 'album' ? `专辑 ${id}` : `歌单 ${id}`),
      cover: cover ? normalizeKugouTemplateCoverUrl(cover) : '',
      trackCount: data.total ?? songs.length,
      // "Artist - Title": an album's songs share the artist in front of the dash
      creator:
        call === 'album' && text(first.filename).includes(' - ')
          ? text(first.filename).split(' - ')[0].trim()
          : undefined,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function artist(id: string): Promise<Artist[]> {
  try {
    return [(await artistService.getArtist('netease', id)).artist]
  } catch (error) {
    if (error instanceof ArtistError && error.code === 'ARTIST_NOT_FOUND') return []
    throw error
  }
}

type Lookup = (id: string) => Promise<Track[] | Playlist[] | Artist[]>

const LOOKUPS: Record<MusicSource, Partial<Record<MusicRefKind, Lookup>>> = {
  netease: { song: neteaseSong, album: neteaseAlbum, playlist: neteasePlaylist, artist },
  tencent: { song: tencentSong, album: tencentAlbum, playlist: tencentPlaylist },
  kugou: { song: kugouSong, album: (id) => kugouList('album', id), playlist: (id) => kugouList('playlist', id) },
}

/** The thing with this (validated) id, as a list of at most one: empty when it does not exist or cannot be looked up. */
export async function lookupById(
  source: MusicSource,
  kind: MusicRefKind,
  id: string,
): Promise<Track[] | Playlist[] | Artist[]> {
  const lookup = LOOKUPS[source][kind]
  if (!lookup) return []
  try {
    return await lookup(id)
  } catch (error) {
    if (error instanceof SearchError || (error as { kind?: string })?.kind) throw error
    logger.error(`Lookup by id failed for ${source} ${kind}:`, error)
    throw new SearchError()
  }
}
