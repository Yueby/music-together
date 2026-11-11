# UI 设计规范

## 组件库

- **shadcn/ui**：`new-york` 风格变体，`neutral` 基色
- **配置**：非 RSC（`"rsc": false`），使用 CSS 变量，Lucide 图标
- **安装路径**：`@/components/ui/`，工具函数 `@/lib/utils`

## 颜色系统

使用 **oklch 色彩空间**，单一深色主题，CSS 变量直接定义在 `:root`（无亮/暗切换）：

```css
:root {
  --background: oklch(0.178 0.005 265); /* 深蓝灰 */
  --foreground: oklch(0.985 0 0); /* 近白 */
  --primary: oklch(0.922 0 0); /* 亮色主色 */
  --card: oklch(0.235 0.008 265); /* 微蓝灰卡片 */
  --accent: oklch(0.35 0.008 265); /* 强调色 */
  /* ... */
}
```

## 字体

- **主字体**：Plus Jakarta Sans（通过 `<link>` 在 `index.html` 加载）
- **回退**：system-ui, -apple-system, sans-serif

## 圆角

基准值 `--radius: 0.625rem`，其他圆角通过计算派生：

```css
--radius-sm: calc(var(--radius) - 4px); /* 小 */
--radius-md: calc(var(--radius) - 2px); /* 中 */
--radius-lg: var(--radius); /* 标准 */
--radius-xl: calc(var(--radius) + 4px); /* 大 */
```

## 图标

使用 **lucide-react**，按需导入：

```typescript
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react'
```

## 动画

- **motion (Framer Motion)**：组件进入/退出动画、列表动画
- **tw-animate-css**：Tailwind 动画预设类
- **自定义动画**：`float` 关键帧（6s 缓动上下浮动）、`marquee` 关键帧（文本溢出自动滚动）

```css
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes marquee {
  0%,
  15% {
    transform: translateX(0);
  }
  45%,
  55% {
    transform: translateX(var(--marquee-distance));
  }
  85%,
  100% {
    transform: translateX(0);
  }
}
```

## MarqueeText 组件

`marquee-text.tsx` 通用文本溢出自动滚动组件，用于播放列表项、SongInfoBar、NowPlaying compact 模式等场景：

- 使用 `ResizeObserver` 检测文本是否溢出容器（`scrollWidth > clientWidth`）
- 溢出时通过 CSS `translateX` 动画实现 pause-scroll-pause 循环（GPU 加速）
- 动画时长根据溢出距离动态计算（`Math.max(5, 4 + overflow / 30)`），长文本滚动更慢
- 未溢出时无动画，等同普通文本
- 遵循 `prefers-reduced-motion` 系统偏好（已有全局 `animation-duration: 0.01ms` 降级）

## 滚动条

自定义 WebKit 滚动条：6px 宽/高，透明轨道，半透明滑块。Firefox 使用 `scrollbar-width: thin`。`.scrollbar-hide` 工具类隐藏滚动条但保持滚动功能（用于移动端设置导航栏等）。

## 设置项（SettingRow）

设置页每一行统一用 `Overlays/Settings/SettingRow`：标签 + 控件，**每行都应带 `description`**。说明不占版面，以标签旁的 `Info` 图标 + Tooltip 呈现（图标是 32px 的点按目标，桌面悬停/聚焦、触屏点按都能打开；图标的 `aria-label` 即说明文字）。滑块等需要显示当前取值的行用 `value` 属性（显示在控件左侧），不要再把读数塞进说明里。

## 歌词渲染

- **AMLL** (`@applemusic-like-lyrics/react`)：Apple Music 风格逐行歌词动画
- **逐词来源**：TTML 在线库（网易云/QQ）、平台原生 YRC（网易云）、平台原生 KRC（酷狗，服务端解析后以 `wordByWord` 返回）
- **PixiJS 背景**：`BackgroundRender` 组件使用 PixiJS 渲染动态专辑封面背景
- 歌词设置可调：对齐锚点、弹簧动画、模糊效果、缩放效果、字重、字体大小、翻译字体大小

## 样式工具函数

```typescript
// cn() — 条件 class 合并（clsx + tailwind-merge）
import { cn } from '@/lib/utils'

<div className={cn('base-class', isActive && 'active-class')} />
```

## Toast 通知

使用 **sonner**，定位在顶部居中：

```typescript
<Toaster position="top-center" richColors />
```

## 触控与 Hover 双模式

项目将**布局**和**交互**解耦为两个正交维度：

| Hook            | 维度 | 媒体查询                  | 控制内容                                      |
| --------------- | ---- | ------------------------- | --------------------------------------------- |
| `useIsMobile()` | 布局 | `(orientation: portrait)` | Drawer 方向、面板高度、Dialog vs Drawer       |
| `useHasHover()` | 交互 | `(hover: hover)`          | hover 工具栏 vs tap 展开、Slider thumb 可见性 |

横屏手机 = `isMobile: false`（使用桌面布局）+ `hasHover: false`（使用触控交互）。

- **Slider Thumb**：进度条 Thumb 默认透明，桌面端 `group-hover` 显示，触控设备通过 `focus:opacity-100` 在触摸拖拽时显示
- **触控目标尺寸**：所有可点击按钮在移动端通过 `min-h-11 min-w-11`（44px）扩大触控热区，桌面端 `sm:min-h-0 sm:min-w-0` 还原视觉尺寸。涉及 QueueDrawer 工具栏、VoteBanner、RoomHeader
- **QueueDrawer tap-to-expand**：触控设备（`isTouch = !hasHover`）点击列表项展开操作工具栏；桌面端通过 `group-hover` 显示工具栏。两种模式在横屏手机上都能正确工作

## 封面图片 onError 回退

- **NowPlaying**：使用 `coverError` state 追踪加载失败，切歌时重置；失败后回退到 `Disc3` 占位图标
- **QueueDrawer**：`<img>` 的 `onError` 隐藏图片并显示 `Music` 占位图标（始终渲染占位 div，通过 `hidden` class 切换）

## 音频加载失败重试

`useHowl` 的 `onloaderror` 处理：

- 首次失败自动重试一次（`retryRef` flag + `howl.load()`）
- 重试仍失败则 toast 显示歌曲名（`trackTitleRef`）并跳到下一首
- `onloaderror` 开头有 stale guard（`howlRef.current !== howl`），防止旧 Howl 实例的重试回调影响新曲
- `loadTrack` 时重置 retry flag 和歌曲名 ref，并清理 `playErrorTimerRef`（防止上一首的 play-error 超时跳过新曲）
- `onload` 和 `onplay` 中对 `howl.duration()` 做 `Number.isFinite` + `> 0` 校验，防止流式加载时无效 duration 写入 store
- `queueAddSchema` 对 `duration` 做 `z.number().finite().nonnegative()` 校验，从数据入口杜绝无效时长

---
