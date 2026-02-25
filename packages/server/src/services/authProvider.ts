import type { Playlist, MusicSource } from '@music-together/shared'
import * as neteaseAuth from './neteaseAuthService.js'
import * as kugouAuth from './kugouAuthService.js'
import * as tencentAuth from './tencentAuthService.js'

// ---------------------------------------------------------------------------
// 统一认证服务接口
// ---------------------------------------------------------------------------

/**
 * 用户信息数据（三平台通用）
 */
export interface UserInfoData {
  nickname: string
  vipType: number
  userId: number
}

/**
 * getUserInfo 统一返回类型
 * - ok=true: 验证成功，包含用户信息
 * - ok=false + reason='expired': Cookie 已过期
 * - ok=false + reason='error': 临时错误（网络/超时等）
 */
export type GetUserInfoResult = { ok: true; data: UserInfoData } | { ok: false; reason: 'expired' | 'error' }

/**
 * 每个音乐平台认证服务必须实现的接口
 */
export interface AuthProvider {
  /** 生成 QR 扫码登录二维码 */
  generateQrCode(): Promise<{ key: string; qrimg: string } | null>

  /** 检查 QR 扫码状态 */
  checkQrStatus(key: string): Promise<{
    status: number
    message: string
    cookie?: string
  }>

  /** 验证 Cookie 并获取用户信息 */
  getUserInfo(cookie: string): Promise<GetUserInfoResult>

  /** 获取用户歌单列表 */
  getUserPlaylists(cookie: string): Promise<Playlist[]>
}

// ---------------------------------------------------------------------------
// 平台策略映射
// ---------------------------------------------------------------------------

/**
 * 平台 → AuthProvider 映射表
 *
 * authController 通过此映射表获取对应平台的认证服务实例，
 * 从而用一份代码处理所有平台的 QR 登录/Cookie 验证/歌单获取。
 */
export const AUTH_PROVIDERS: Record<MusicSource, AuthProvider> = {
  netease: neteaseAuth,
  kugou: kugouAuth,
  tencent: tencentAuth,
}
