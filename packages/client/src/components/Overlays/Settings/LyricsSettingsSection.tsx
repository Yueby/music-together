import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/stores/settingsStore'
import { SettingRow } from './SettingRow'

export function LyricsSettingsSection() {
  const lyricAlignAnchor = useSettingsStore((s) => s.lyricAlignAnchor)
  const lyricAlignPosition = useSettingsStore((s) => s.lyricAlignPosition)
  const lyricEnableSpring = useSettingsStore((s) => s.lyricEnableSpring)
  const lyricEnableBlur = useSettingsStore((s) => s.lyricEnableBlur)
  const lyricEnableScale = useSettingsStore((s) => s.lyricEnableScale)
  const lyricFontWeight = useSettingsStore((s) => s.lyricFontWeight)
  const lyricFontSize = useSettingsStore((s) => s.lyricFontSize)
  const setLyricAlignAnchor = useSettingsStore((s) => s.setLyricAlignAnchor)
  const setLyricAlignPosition = useSettingsStore((s) => s.setLyricAlignPosition)
  const setLyricEnableSpring = useSettingsStore((s) => s.setLyricEnableSpring)
  const setLyricEnableBlur = useSettingsStore((s) => s.setLyricEnableBlur)
  const setLyricEnableScale = useSettingsStore((s) => s.setLyricEnableScale)
  const setLyricFontWeight = useSettingsStore((s) => s.setLyricFontWeight)
  const setLyricFontSize = useSettingsStore((s) => s.setLyricFontSize)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">歌词对齐</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="对齐锚点" description="当前歌词行在视口中的锚定方式">
          <Select
            value={lyricAlignAnchor}
            onValueChange={(v) =>
              setLyricAlignAnchor(v as 'top' | 'center' | 'bottom')
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">顶部</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="bottom">底部</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="对齐位置"
          description={`当前: ${Math.round(lyricAlignPosition * 100)}%`}
        >
          <Slider
            value={[lyricAlignPosition * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => setLyricAlignPosition(v[0] / 100)}
            className="w-32"
          />
        </SettingRow>
      </div>

      <div>
        <h3 className="text-base font-semibold">歌词动画</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="弹簧动画" description="歌词行切换时的弹簧物理效果">
          <Switch
            checked={lyricEnableSpring}
            onCheckedChange={setLyricEnableSpring}
          />
        </SettingRow>

        <SettingRow label="模糊效果" description="非当前行歌词模糊">
          <Switch
            checked={lyricEnableBlur}
            onCheckedChange={setLyricEnableBlur}
          />
        </SettingRow>

        <SettingRow label="缩放效果" description="当前行歌词放大突出显示">
          <Switch
            checked={lyricEnableScale}
            onCheckedChange={setLyricEnableScale}
          />
        </SettingRow>
      </div>

      <div>
        <h3 className="text-base font-semibold">字体</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="字体粗细">
          <Select
            value={String(lyricFontWeight)}
            onValueChange={(v) => setLyricFontWeight(parseInt(v, 10))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="400">常规</SelectItem>
              <SelectItem value="500">中等</SelectItem>
              <SelectItem value="600">半粗</SelectItem>
              <SelectItem value="700">粗体</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="字体大小">
          <Select
            value={String(lyricFontSize)}
            onValueChange={(v) => setLyricFontSize(parseInt(v, 10))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="75">较小</SelectItem>
              <SelectItem value="90">偏小</SelectItem>
              <SelectItem value="100">默认</SelectItem>
              <SelectItem value="110">偏大</SelectItem>
              <SelectItem value="125">较大</SelectItem>
              <SelectItem value="150">最大</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  )
}
