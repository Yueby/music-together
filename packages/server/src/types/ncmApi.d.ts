/**
 * @neteasecloudmusicapienhanced/api 类型声明
 *
 * 该库是 CJS 模块，通过 module.exports 导出动态生成的方法。
 * 原始 interface.d.ts 只声明了命名导出函数，没有声明默认导出，
 * 导致 `import ncmApi from '...'` 无法获得正确类型。
 *
 * 此文件补充默认导出的类型声明，覆盖项目中实际使用的 API 方法。
 */
declare module '@neteasecloudmusicapienhanced/api' {
  // 扩展 RequestBaseConfig 以支持运行时使用的参数
  interface RequestBaseConfig {
    /** 添加时间戳防止缓存（原始类型定义中缺失） */
    timestamp?: number
    cookie?: string
  }

  /** QR 登录 key 响应 */
  interface QrKeyResponse {
    code: number
    data?: { unikey?: string }
  }

  /** QR 登录二维码生成响应 */
  interface QrCreateResponse {
    code: number
    data?: { qrimg?: string }
  }

  /** QR 扫码状态检查响应 */
  interface QrCheckResponse {
    code: number
    cookie?: string
  }

  /** 登录状态响应 */
  interface LoginStatusResponse {
    code: number
    data?: {
      profile?: {
        nickname?: string
        vipType?: number
        userId?: number
      }
    }
  }

  /** 用户歌单列表响应 */
  interface UserPlaylistResponse {
    code: number
    playlist?: Array<{
      id: number
      name?: string
      coverImgUrl?: string
      trackCount?: number
      creator?: { nickname?: string }
      description?: string
    }>
  }

  interface NcmApiInstance {
    login_qr_key(params: RequestBaseConfig): Promise<{ body: QrKeyResponse }>
    login_qr_create(params: { key: string; qrimg: boolean } & RequestBaseConfig): Promise<{ body: QrCreateResponse }>
    login_qr_check(params: { key: string } & RequestBaseConfig): Promise<{ body: QrCheckResponse }>
    login_status(params: RequestBaseConfig): Promise<{ body: LoginStatusResponse }>
    user_playlist(
      params: { uid: number; limit: number; offset: number } & RequestBaseConfig,
    ): Promise<{ body: UserPlaylistResponse }>

    /** 获取歌词（含逐词 YRC） */
    lyric_new(params: { id: string | number } & RequestBaseConfig): Promise<{
      body: {
        code?: number
        lrc?: { lyric?: string }
        tlyric?: { lyric?: string }
        yrc?: { lyric?: string }
        [key: string]: unknown
      }
    }>

    /** 分页获取歌单全部歌曲 */
    playlist_track_all(params: Record<string, unknown>): Promise<{
      body: {
        code?: number
        songs?: Record<string, unknown>[]
        [key: string]: unknown
      }
    }>
    album(params: Record<string, unknown>): Promise<{
      body: {
        code?: number
        songs?: Record<string, unknown>[]
        [key: string]: unknown
      }
    }>
  }

  const ncmApi: NcmApiInstance
  export default ncmApi
}
