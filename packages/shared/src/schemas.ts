import * as z from 'zod/v4'
import { LIMITS } from './constants.js'

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export const roomCreateSchema = z.object({
  nickname: z.string().min(1, '昵称不能为空').max(LIMITS.NICKNAME_MAX_LENGTH, '昵称过长'),
  roomName: z.string().max(LIMITS.ROOM_NAME_MAX_LENGTH, '房间名过长').optional(),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH, '密码过长').optional(),
})

export const roomJoinSchema = z.object({
  roomId: z.string().min(1, '房间号不能为空'),
  nickname: z.string().min(1, '昵称不能为空').max(LIMITS.NICKNAME_MAX_LENGTH, '昵称过长'),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH).optional(),
  rejoinToken: z.string().min(1).max(500).optional(),
})

export const audioQualitySchema = z.union([z.literal(128), z.literal(192), z.literal(320), z.literal(999)])

export const roomSettingsSchema = z.object({
  name: z.string().min(1).max(LIMITS.ROOM_NAME_MAX_LENGTH).optional(),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH).nullable().optional(),
  audioQuality: audioQualitySchema.optional(),
})

export const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']),
})

// ---------------------------------------------------------------------------
// Room — auto fallback notifications
// ---------------------------------------------------------------------------

export const roomAutoFallbackSchema = z.object({
  attemptId: z.string().min(1).max(100),
  status: z.enum(['trying', 'success', 'failed']),
  fromSource: z.enum(['netease', 'tencent']),
  toSource: z.enum(['netease', 'tencent']),
  trackTitle: z.string().min(1).max(500),
  reasonType: z.enum(['VIP_REQUIRED', 'COPYRIGHT_RESTRICTED', 'NO_RESOURCE', 'TIMEOUT', 'UNKNOWN']).optional(),
  reasonDetail: z.string().max(200).optional(),
})

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export const playerSeekSchema = z.object({
  currentTime: z.number().finite().nonnegative(),
})

export const playerSyncSchema = z.object({
  currentTime: z.number().finite().nonnegative(),
  hostServerTime: z.number().finite().positive().optional(),
  revision: z.number().int().nonnegative(),
  trackId: z.string().min(1).max(200),
})

export const playerSetModeSchema = z.object({
  mode: z.enum(['sequential', 'loop-all', 'loop-one', 'shuffle']),
})

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

const trackSchema = z.object({
  id: z.string().max(200),
  title: z.string().max(500),
  artist: z.array(z.string().max(200)).max(20),
  album: z.string().max(500),
  duration: z.number().finite().nonnegative(),
  cover: z.string().max(2000),
  source: z.enum(['netease', 'tencent', 'kugou']),
  sourceId: z.string().max(200),
  urlId: z.string().max(200),
  lyricId: z.string().max(200).optional(),
  picId: z.string().max(200).optional(),
  streamUrl: z.string().max(2000).optional(),
  vip: z.boolean().optional(),
})

export const queueAddSchema = z.object({
  track: trackSchema,
})

export const queueInsertAfterCurrentSchema = queueAddSchema

export const queueAddBatchSchema = z.object({
  tracks: z.array(trackSchema).min(1).max(LIMITS.QUEUE_BATCH_MAX_SIZE),
  playlistName: z.string().max(200).optional(),
})

export const queueRemoveSchema = z.object({ trackId: z.string().max(200) })
export const queueReorderSchema = z.object({
  trackIds: z.array(z.string().max(200)).max(LIMITS.QUEUE_MAX_SIZE),
})

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(LIMITS.CHAT_CONTENT_MAX_LENGTH),
})

// ---------------------------------------------------------------------------
// REST API – Music routes
// ---------------------------------------------------------------------------

const musicSourceSchema = z.enum(['netease', 'tencent', 'kugou'])

export const searchQuerySchema = z.object({
  source: musicSourceSchema,
  keyword: z.string().min(1).max(LIMITS.SEARCH_KEYWORD_MAX_LENGTH),
  limit: z.coerce.number().int().min(1).max(LIMITS.SEARCH_PAGE_SIZE_MAX).default(20),
  page: z.coerce.number().int().min(1).max(LIMITS.SEARCH_PAGE_MAX).default(1),
  type: z.enum(['song', 'album', 'playlist', 'artist']).optional().default('song'),
})

/** Artist ids are numeric on NetEase; kept as a bounded string like every other platform id. */
const artistIdSchema = z.string().min(1).max(LIMITS.PLAYLIST_ID_MAX_LENGTH).regex(/^[\w-]+$/, 'Invalid artist id')

/** Artist home page: profile, hot songs and the first page of albums. */
export const artistQuerySchema = z.object({
  source: musicSourceSchema,
  id: artistIdSchema,
})

/** Further pages of an artist's songs or albums. */
export const artistPageQuerySchema = z.object({
  source: musicSourceSchema,
  id: artistIdSchema,
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  limit: z.coerce.number().int().min(1).max(LIMITS.SEARCH_PAGE_SIZE_MAX).default(30),
})

export const urlQuerySchema = z.object({
  source: musicSourceSchema,
  urlId: z.string().min(1).max(200),
  bitrate: z.coerce.number().int().min(64).max(2000).default(320),
})

export const lyricQuerySchema = z.object({
  source: musicSourceSchema,
  lyricId: z.string().min(1).max(200),
})

/** Sources that have a word-by-word TTML lyric library. */
export const TTML_SOURCES = ['netease', 'tencent'] as const

/** Same character set as real NetEase song IDs and QQ song mids; the server builds the upstream URL from it. */
export const ttmlQuerySchema = z.object({
  source: z.enum(TTML_SOURCES),
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
})

export const coverQuerySchema = z.object({
  source: musicSourceSchema,
  picId: z.string().min(1).max(200),
  size: z.coerce.number().int().min(16).max(2000).default(300),
})

/**
 * A page of the caller's *own* playlist (private tracks included). Always scoped to a room: the room's account pool
 * is where the caller's music-platform login lives. Public lists use `playlistQuerySchema` and never carry a room.
 */
export const myPlaylistQuerySchema = z.object({
  source: musicSourceSchema,
  id: z.string().min(1).max(LIMITS.PLAYLIST_ID_MAX_LENGTH),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).default(0),
  roomId: z.string().min(1).max(10),
  type: z.enum(['playlist', 'album']).optional().default('playlist'),
})

/** A page of a public playlist or album. Anonymous by design: it never selects a music account. */
export const playlistQuerySchema = z.object({
  source: musicSourceSchema,
  id: z.string().min(1).max(LIMITS.PLAYLIST_ID_MAX_LENGTH),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).optional(),
  type: z.enum(['playlist', 'album']).optional().default('playlist'),
})

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

const voteWithoutPayloadSchema = z.object({
  action: z.enum(['pause', 'resume', 'next', 'prev']),
  payload: z.undefined().optional(),
})

export const voteStartSchema = z.discriminatedUnion('action', [
  voteWithoutPayloadSchema,
  z.object({ action: z.literal('set-mode'), payload: playerSetModeSchema }),
  z.object({ action: z.literal('play-track'), payload: z.object({ trackId: z.string().min(1).max(200) }) }),
  z.object({ action: z.literal('remove-track'), payload: z.object({ trackId: z.string().min(1).max(200) }) }),
])

export const voteCastSchema = z.object({
  approve: z.boolean(),
})

/** Mini-app room media request: only server room/track identifiers; arrays (duplicate query keys) are invalid. */
export const mappRoomMediaQuerySchema = z.strictObject({
  roomId: z.string().regex(/^[A-Z0-9_-]{6}$/),
  trackId: z.string().min(1).max(200),
})
