import * as z from 'zod/v4'
import { LIMITS } from './constants.js'

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export const roomCreateSchema = z.object({
  nickname: z.string().min(1, '昵称不能为空').max(LIMITS.NICKNAME_MAX_LENGTH, '昵称过长'),
  roomName: z.string().max(LIMITS.ROOM_NAME_MAX_LENGTH, '房间名过长').optional(),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH, '密码过长').optional(),
  userId: z.string().min(1).max(50).optional(),
})

export const roomJoinSchema = z.object({
  roomId: z.string().min(1, '房间号不能为空'),
  nickname: z.string().min(1, '昵称不能为空'),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH).optional(),
  userId: z.string().min(1).max(50).optional(),
})

export const audioQualitySchema = z.union([
  z.literal(128),
  z.literal(192),
  z.literal(320),
  z.literal(999),
])

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
// Player
// ---------------------------------------------------------------------------

export const playerSeekSchema = z.object({
  currentTime: z.number().finite().nonnegative(),
})

export const playerSyncSchema = z.object({
  currentTime: z.number().finite().nonnegative(),
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
})

export const urlQuerySchema = z.object({
  source: musicSourceSchema,
  urlId: z.string().min(1),
  bitrate: z.coerce.number().int().positive().default(320),
})

export const lyricQuerySchema = z.object({
  source: musicSourceSchema,
  lyricId: z.string().min(1),
})

export const coverQuerySchema = z.object({
  source: musicSourceSchema,
  picId: z.string().min(1),
  size: z.coerce.number().int().positive().default(300),
})

export const playlistQuerySchema = z.object({
  source: musicSourceSchema,
  id: z.string().min(1).max(LIMITS.PLAYLIST_ID_MAX_LENGTH),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0).optional(),
  roomId: z.string().min(1).max(10).optional(),
  userId: z.string().min(1).max(30).optional(),
})

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export const voteStartSchema = z.object({
  action: z.enum(['pause', 'resume', 'next', 'prev', 'set-mode', 'play-track', 'remove-track']),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const voteCastSchema = z.object({
  approve: z.boolean(),
})
