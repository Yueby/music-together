import { UNKNOWN_ARTIST } from '@music-together/shared'
import type { MusicSource, Track } from '@music-together/shared'
import { nanoid } from 'nanoid'

/**
 * Raw song data of each music platform → our `Track`. Pure: no cache, no network. Each platform names its fields
 * differently, and the upstream shapes are too dynamic to type strictly, hence the loose `any` access below.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- external platform API response shapes */

/** Navigate a dot-separated path in an object (a missing step gives `undefined`). */
export function navigatePath(data: Record<string, unknown>, path: string): unknown {
  let result: unknown = data
  for (const key of path.split('.')) {
    result = (result as Record<string, unknown>)?.[key]
  }
  return result
}

/** Convert a kugou song object from getPlaylistTracks to a Track. `null` when the song has no hash. */
export function kugouSongToTrack(song: Record<string, unknown>): Track | null {
  // Cast for convenient dynamic property access
  const song_ = song as Record<string, any>
  const hash = song_.hash || song_.audio_info?.hash || ''
  if (!hash) return null

  // filename is typically "Artist - Title" or "Artist1、Artist2 - Title"
  const filename = String(song_.filename || song_.name || '')
  const parts = filename.split(' - ')
  const artistStr = parts.length > 1 ? parts[0].trim() : ''
  const artists = artistStr
    ? artistStr
        .split(/[、,，&]/)
        .map((a: string) => a.trim())
        .filter(Boolean)
    : []
  const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : filename

  // Duration: Kugou's native API returns seconds (e.g. 240), but some endpoints
  // return milliseconds (e.g. 240000). Threshold 100000 (~27 hours in seconds)
  // safely distinguishes the two — any value above it is assumed to be milliseconds.
  let duration = Number(song_.duration ?? song_.timelen ?? 0)
  if (duration > 100000) duration = Math.floor(duration / 1000)

  // VIP / privilege
  const privilege = song_.privilege ?? song_.pay_type ?? 0
  const isVip = privilege > 0

  return {
    id: nanoid(),
    source: 'kugou',
    sourceId: hash,
    title,
    artist: artists,
    album: String(song_.album_name || song_.remark || ''),
    duration,
    cover: '',
    lyricId: hash,
    urlId: hash,
    picId: hash,
    vip: isVip,
  }
}

/**
 * Convert raw platform-specific song data (search results, playlist pages) to our Track format.
 * Each platform returns different field names, so we need per-platform parsing.
 */
export function rawToTrack(song: Record<string, unknown>, source: MusicSource): Track {
  // Cast to any for convenient dynamic property access on external API responses
  const s = song as Record<string, any>
  switch (source) {
    case 'netease': {
      // Names and ids stay index-aligned: an artist without a name is dropped with its id.
      const neteaseCredits = ((s.ar ?? []) as Array<Record<string, unknown>>).filter(
        (a) => typeof a?.name === 'string' && a.name,
      )
      const neteaseArtists = neteaseCredits.map((a) => a.name as string)
      const neteaseArtistIds = neteaseCredits.map((a) => (a.id === undefined || a.id === null ? '' : String(a.id)))
      return {
        id: nanoid(),
        title: s.name || 'Unknown',
        artist: neteaseArtists.length ? neteaseArtists : [UNKNOWN_ARTIST],
        // Lets the UI open the artist page directly instead of guessing from the name. Real NetEase ids are positive.
        ...(neteaseArtists.length && neteaseArtistIds.every((id) => /^[1-9]\d{0,19}$/.test(id))
          ? { artistIds: neteaseArtistIds }
          : {}),
        album: s.al?.name || '',
        duration: Math.round((s.dt || 0) / 1000), // ms -> seconds
        cover: '', // resolved via pic()
        source,
        sourceId: String(s.id),
        urlId: String(s.id),
        lyricId: String(s.id),
        picId: String(s.al?.pic_str || s.al?.pic || ''),
        // fee: 0=免费, 1=VIP, 4=付费专辑, 8=低音质免费
        vip: s.fee === 1 || s.fee === 4 || s.privilege?.fee === 1 || s.privilege?.fee === 4,
      }
    }

    case 'tencent': {
      // Tencent sometimes wraps data in musicData
      const t = s.musicData || s
      return {
        id: nanoid(),
        title: t.name || 'Unknown',
        artist: (t.singer || []).map((a: Record<string, unknown>) => a.name),
        album: (t.album?.title || '').trim(),
        duration: t.interval || 0, // already in seconds
        cover: '', // resolved via pic()
        source,
        sourceId: String(t.mid),
        urlId: String(t.mid),
        lyricId: String(t.mid),
        picId: String(t.album?.mid || ''),
        // pay.pay_play=1 表示需要 VIP, pay.pay_month=1 表示月度VIP, pay.price_track>0 表示付费单曲
        vip: t.pay?.pay_play === 1 || t.pay?.pay_month === 1 || (t.pay?.price_track ?? 0) > 0,
      }
    }

    case 'kugou': {
      // Kugou encodes artist/title in filename: "Artist - Title"
      const filename = s.filename || s.fileName || ''
      const parts = filename.split(' - ')
      let trackName = filename
      let artists: string[] = []
      if (parts.length >= 2) {
        artists = parts[0]
          .split(/[、,，&]/)
          .map((a: string) => a.trim())
          .filter(Boolean)
        trackName = parts.slice(1).join(' - ')
      }
      return {
        id: nanoid(),
        title: trackName || 'Unknown',
        artist: artists.length > 0 ? artists : [UNKNOWN_ARTIST],
        album: s.album_name || '',
        duration: s.duration || 0, // seconds
        cover: '', // resolved via pic() (requires API call)
        source,
        sourceId: String(s.hash),
        urlId: String(s.hash),
        lyricId: String(s.hash),
        picId: String(s.hash),
        // privilege 位掩码: & 8 表示 VIP; pay_type > 0 也表示付费
        vip: ((s.privilege ?? 0) & 8) !== 0 || (s.pay_type ?? 0) > 0,
      }
    }

    default: {
      // Exhaustive check — if a new MusicSource is added, TypeScript will error here
      const _exhaustive: never = source
      throw new Error(`Unsupported music source: ${_exhaustive}`)
    }
  }
}
