# ---- 阶段 1: 安装依赖 ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile

# ---- 阶段 2: 构建 ----
FROM deps AS build
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/
RUN pnpm --filter @music-together/shared run build 2>/dev/null || true
RUN pnpm --filter @music-together/server run build
RUN pnpm --filter @music-together/client run build

# ---- 阶段 3: 生产镜像 ----
FROM node:22-alpine AS production
RUN corepack enable
WORKDIR /app

# 复制所有 workspace 包的 package.json（pnpm workspace 需要完整结构）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# 只安装 server 的生产依赖（三个点表示包含依赖链，即 shared）
RUN pnpm install --frozen-lockfile --prod --filter @music-together/server...

# 复制构建产物
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/client/dist packages/client/dist
COPY packages/shared/src packages/shared/src

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "packages/server/dist/index.js"]
