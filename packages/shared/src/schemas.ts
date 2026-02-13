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
  nickname: z.string().min(1, '昵称不能为空'),
  password: z.string().optional(),
})

export const roomSettingsSchema = z.object({
  name: z.string().min(1).max(LIMITS.ROOM_NAME_MAX_LENGTH).optional(),
  password: z.string().max(LIMITS.ROOM_PASSWORD_MAX_LENGTH).nullable().optional(),
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

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const queueAddSchema = z.object({
  track: z.object({
    id: z.string(),
    title: z.string(),
    artist: z.array(z.string()),
    album: z.string(),
    duration: z.number(),
    cover: z.string(),
    source: z.enum(['netease', 'tencent', 'kugou']),
    sourceId: z.string(),
    urlId: z.string(),
    lyricId: z.string().optional(),
    picId: z.string().optional(),
    streamUrl: z.string().optional(),
    vip: z.boolean().optional(),
  }),
})

export const queueRemoveSchema = z.object({ trackId: z.string() })
export const queueReorderSchema = z.object({ trackIds: z.array(z.string()) })

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

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export const voteStartSchema = z.object({
  action: z.enum(['pause', 'resume', 'next', 'prev']),
})

export const voteCastSchema = z.object({
  approve: z.boolean(),
})
