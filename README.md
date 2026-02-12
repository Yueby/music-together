# Music Together

在线同步听歌平台 - 和朋友一起听歌，实时同步。

## 功能

- **房间系统** - 创建/加入房间，房间号邀请
- **多音源搜索** - 支持网易云、QQ音乐、酷狗、酷我、百度 5 大平台
- **同步播放** - 房间内所有人听到同一首歌的同一进度
- **实时聊天** - 房间内文字聊天
- **权限控制** - 房主模式 / 协作模式

## 技术栈

- **前端**: React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Zustand + Howler.js
- **后端**: Node.js + Express + Socket.IO + @meting/core
- **Monorepo**: pnpm workspaces

## 开发

```bash
# 安装依赖
pnpm install

# 启动前后端（并行）
pnpm dev

# 仅启动前端
pnpm dev:client

# 仅启动后端
pnpm dev:server
```

前端: http://localhost:5173
后端: http://localhost:3001

## 项目结构

```
packages/
  client/   - 前端 React 应用
  server/   - 后端 Node.js 应用
  shared/   - 前后端共享类型与常量
```
