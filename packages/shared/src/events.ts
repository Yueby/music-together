export const EVENTS = {
  // Room lifecycle
  ROOM_CREATE: 'room:create',
  ROOM_CREATED: 'room:created',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
  ROOM_SETTINGS: 'room:settings',
  ROOM_ERROR: 'room:error',

  // Room discovery
  ROOM_LIST: 'room:list',
  ROOM_LIST_UPDATE: 'room:list_update',

  // Player controls
  PLAYER_PLAY: 'player:play',
  PLAYER_PAUSE: 'player:pause',
  PLAYER_SEEK: 'player:seek',
  PLAYER_NEXT: 'player:next',
  PLAYER_SYNC: 'player:sync',
  PLAYER_SYNC_REQUEST: 'player:sync_request',
  PLAYER_SYNC_RESPONSE: 'player:sync_response',

  // Queue management
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  QUEUE_REORDER: 'queue:reorder',
  QUEUE_UPDATED: 'queue:updated',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]
