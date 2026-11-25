import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { AUDIO_LATENCY_MAX_MS, AUDIO_LATENCY_MIN_MS } from '@/lib/constants'
import { usePlayerStore } from '@/stores/playerStore'
import { SettingRow } from './SettingRow'

function formatMilliseconds(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded} ms`
}

export function SyncSection() {
  const offset = usePlayerStore((s) => s.audioLatencyOffsetMs)
  const detected = usePlayerStore((s) => s.detectedAudioLatencyMs)
  const drift = usePlayerStore((s) => s.syncDrift)
  const setOffset = usePlayerStore((s) => s.setAudioLatencyOffsetMs)
  const automatic = offset === null
  const effective = offset ?? detected

  return (
    <div>
      <h3 className="text-base font-semibold">音频延迟补偿</h3>
      <Separator className="mt-2 mb-4" />
      <SettingRow label="自动检测设备延迟" description="微应用（WebAudio）自动补偿音频管线延迟，网页端默认补偿 0 ms">
        <Switch
          aria-label="自动检测设备延迟"
          checked={automatic}
          onCheckedChange={(checked) => setOffset(checked ? null : Math.round(detected / 10) * 10)}
        />
      </SettingRow>
      <SettingRow
        label="延迟补偿"
        description="正值让本机音频提前播放"
        value={formatMilliseconds(effective)}
        onReset={automatic ? undefined : () => setOffset(null)}
      >
        <Slider
          aria-label="延迟补偿"
          aria-valuetext={formatMilliseconds(effective)}
          min={AUDIO_LATENCY_MIN_MS}
          max={AUDIO_LATENCY_MAX_MS}
          step={10}
          value={[effective]}
          onValueChange={([value]) => setOffset(value)}
          disabled={automatic}
          className="min-h-8 w-20 sm:w-32 [&_[data-slot=slider-thumb]]:opacity-100"
        />
      </SettingRow>
      <p className="mt-1 text-xs text-muted-foreground">使用蓝牙耳机或遇到声画不同步时，可切换到手动调节，尝试 +150 至 +300 ms。</p>
      <dl className="mt-5 grid grid-cols-3 gap-x-2 rounded-lg border px-3 py-3 text-xs sm:px-4">
        <div>
          <dt className="text-muted-foreground">检测延迟</dt>
          <dd className="mt-1 font-medium tabular-nums">{formatMilliseconds(detected)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">生效补偿</dt>
          <dd className="mt-1 font-medium tabular-nums">{formatMilliseconds(effective)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">同步偏差</dt>
          <dd className="mt-1 font-medium tabular-nums">{formatMilliseconds(drift * 1000)}</dd>
        </div>
      </dl>
    </div>
  )
}
