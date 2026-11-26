import { NumericInput } from '@/components/ui/numeric-input'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  AUDIO_LATENCY_MAX_MS,
  AUDIO_LATENCY_MIN_MS,
  DRIFT_WARNING_THRESHOLD_MS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useState } from 'react'
import { SettingRow } from './SettingRow'

const ZERO_OFFSET_PERCENT =
  ((0 - AUDIO_LATENCY_MIN_MS) / (AUDIO_LATENCY_MAX_MS - AUDIO_LATENCY_MIN_MS)) * 100

function formatSignedMs(value: number): string {
  const rounded = Math.round(value) || 0
  return `${rounded > 0 ? '+' : ''}${rounded} ms`
}

function formatDurationMs(value: number): string {
  const rounded = Math.max(0, Math.round(value)) || 0
  return `${rounded} ms`
}

export function SyncSection() {
  const offset = usePlayerStore((s) => s.audioLatencyOffsetMs)
  const detected = usePlayerStore((s) => s.detectedAudioLatencyMs)
  const drift = usePlayerStore((s) => s.syncDrift)
  const setOffset = usePlayerStore((s) => s.setAudioLatencyOffsetMs)
  const [draftOffset, setDraftOffset] = useState<number | null>(null)

  const automatic = offset === null
  const effective = Math.round(offset ?? detected) || 0
  const displayedOffset = automatic ? effective : (draftOffset ?? effective)
  const driftMs = Math.round(drift * 1000) || 0
  const isHighDrift = Math.abs(driftMs) > DRIFT_WARNING_THRESHOLD_MS

  return (
    <div className="space-y-6">
      {/* ---- 同步状态 ---- */}
      <div>
        <h3 className="text-base font-semibold">同步状态</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="同步偏移" description="你的播放进度与房间的差距，偏大时会自动校正">
          <span
            className={cn(
              'font-mono text-sm tabular-nums',
              isHighDrift ? 'text-yellow-500' : 'text-muted-foreground',
            )}
          >
            {formatSignedMs(driftMs)}
          </span>
        </SettingRow>

        <SettingRow label="设备检测延迟" description="系统探测到的本机输出延迟，不支持探测时显示 0 ms">
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatDurationMs(detected)}
          </span>
        </SettingRow>
      </div>

      {/* ---- 延迟补偿 ---- */}
      <div>
        <h3 className="text-base font-semibold">延迟补偿</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow
          label="自动检测设备延迟"
          description="自动按检测到的设备延迟补偿；网页端无法探测，默认按 0 ms 补偿，关闭后可手动调节（仅保存在本机）"
        >
          <Switch
            aria-label="自动检测设备延迟"
            checked={automatic}
            onCheckedChange={(checked) => {
              setDraftOffset(null)
              if (checked) {
                setOffset(null)
              } else {
                const snapped = Math.round(detected / 10) * 10
                setOffset(Math.min(AUDIO_LATENCY_MAX_MS, Math.max(AUDIO_LATENCY_MIN_MS, snapped)))
              }
            }}
          />
        </SettingRow>

        <div>
          <SettingRow
            label="延迟补偿"
            description="正值让本机音频提前播放；蓝牙耳机可尝试 +150 至 +300 ms"
            onReset={
              automatic
                ? undefined
                : () => {
                    setDraftOffset(null)
                    setOffset(null)
                  }
            }
          >
            <NumericInput
              value={displayedOffset}
              onChange={(value) => {
                setDraftOffset(null)
                setOffset(value)
              }}
              min={AUDIO_LATENCY_MIN_MS}
              max={AUDIO_LATENCY_MAX_MS}
              step={1}
              disabled={automatic}
              suffix="ms"
              aria-label="延迟补偿（毫秒）"
              className="h-9 w-24 text-sm sm:h-8"
            />
          </SettingRow>

          <div className="-mt-1 pb-3">
            <Slider
              aria-label="延迟补偿"
              aria-valuetext={formatSignedMs(displayedOffset)}
              min={AUDIO_LATENCY_MIN_MS}
              max={AUDIO_LATENCY_MAX_MS}
              step={10}
              value={[displayedOffset]}
              onValueChange={([value]) => setDraftOffset(value)}
              onValueCommit={([value]) => {
                setDraftOffset(null)
                setOffset(value)
              }}
              disabled={automatic}
              className="min-h-8 w-full [&_[data-slot=slider-thumb]]:opacity-100"
            />
            <div className="relative flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground/70 select-none">
              <span>{formatSignedMs(AUDIO_LATENCY_MIN_MS)}</span>
              <span
                className="absolute -translate-x-1/2"
                style={{ left: `${ZERO_OFFSET_PERCENT}%` }}
              >
                0 ms
              </span>
              <span>{formatSignedMs(AUDIO_LATENCY_MAX_MS)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
