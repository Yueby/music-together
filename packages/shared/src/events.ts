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
  PLAYER_RESUME: 'player:resume',
  PLAYER_SEEK: 'player:seek',
  PLAYER_NEXT: 'player:next',
  PLAYER_PREV: 'player:prev',
  PLAYER_SYNC: 'player:sync',
  PLAYER_SYNC_REQUEST: 'player:sync_request',
  PLAYER_SYNC_RESPONSE: 'player:sync_response',
  PLAYER_SET_MODE: 'player:set_mode',

  // Queue management
  QUEUE_ADD: 'queue:add',
  QUEUE_REMOVE: 'queue:remove',
  QUEUE_REORDER: 'queue:reorder',
  QUEUE_CLEAR: 'queue:clear',
  QUEUE_UPDATED: 'queue:updated',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',

  // Role management
  ROOM_SET_ROLE: 'room:set_role',
  ROOM_ROLE_CHANGED: 'room:role_changed',

  // Voting
  VOTE_START: 'vote:start',
  VOTE_STARTED: 'vote:started',
  VOTE_CAST: 'vote:cast',
  VOTE_RESULT: 'vote:result',

  // NTP clock synchronisation
  NTP_PING: 'ntp:ping',
  NTP_PONG: 'ntp:pong',

  // Platform authentication
  AUTH_REQUEST_QR: 'auth:request_qr',
  AUTH_QR_GENERATED: 'auth:qr_generated',
  AUTH_CHECK_QR: 'auth:check_qr',
  AUTH_QR_STATUS: 'auth:qr_status',
  AUTH_SET_COOKIE: 'auth:set_cookie',
  AUTH_SET_COOKIE_RESULT: 'auth:set_cookie_result',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_STATUS_UPDATE: 'auth:status_update',
  AUTH_MY_STATUS: 'auth:my_status',
  AUTH_GET_STATUS: 'auth:get_status',

  // Playlist
  PLAYLIST_GET_MY: 'playlist:get_my',
  PLAYLIST_MY_LIST: 'playlist:my_list',

  // Queue batch
  QUEUE_ADD_BATCH: 'queue:add_batch',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]
