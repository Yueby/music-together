<div align="center">

# **⚙️ UnblockNeteaseMusic - Utils**

[![Version](https://img.shields.io/npm/v/@neteasecloudmusicapienhanced/unblockmusic-utils)](https://www.npmjs.com/package/@neteasecloudmusicapienhanced/unblockmusic-utils)
[![License](https://img.shields.io/npm/l/@neteasecloudmusicapienhanced/unblockmusic-utils)](LICENSE)
[![Node](https://img.shields.io/node/v/@neteasecloudmusicapienhanced/unblockmusic-utils)](https://nodejs.org/)

为 [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced) 提供的音源匹配工具

</div>

---

## 项目特点

- **多音源支持** - 内置多个音源模块，自动切换获取最佳链接
- **RESTful API** - 标准 HTTP 接口，易于集成
- **模块化设计** - 可作为独立服务或 npm 包使用
- **简单部署** - 支持 Vercel 一键部署

## 📦 安装

### 克隆项目

```bash
git clone https://github.com/NeteaseCloudMusicApiEnhanced/UnblockNeteaseMusic-utils.git
cd UnblockNeteaseMusic-utils

# 安装依赖
pnpm install  # 推荐
# 或
npm install
```

### 直接使用 npx（无需安装）

```bash
npx @neteasecloudmusicapienhanced/unblockmusic-utils
```

## 🚀 快速开始

### 命令行运行

```bash
# 使用默认端口 3000
npm run start
pnpm start

# 指定端口
npx . --port 8080
PORT=8080 npm run start

# 显示帮助信息
npx . --help
```

### 开发模式

```bash
npm run dev  # 使用 nodemon 自动重启
```

### Vercel 部署

项目已配置 `vercel.json`，可以直接推送到 Vercel 部署：

```bash
vercel deploy
```

## 📡 API 文档

### 获取音乐链接

#### GET /match

```bash
curl "http://localhost:3000/match?id=123456"
curl "http://localhost:3000/match?id=123456&source=unm"
```

#### POST /match

```bash
curl -X POST http://localhost:3000/match \
  -H "Content-Type: application/json" \
  -d '{"id": "123456", "source": "unm"}'
```

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 网易云音乐歌曲 ID |
| `source` | string | ❌ | 指定音源模块（不指定则自动选择） |

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "url": "https://example.com/music.mp3"
  }
}
```

### 内部接口

#### 获取音源列表

```bash
GET /inner/modules
```

响应：

```json
{
  "code": 200,
  "data": {
    "modules": ["baka", "gdmusic", "msls", "qijieya", "unm"]
  }
}
```

#### 获取版本信息

```bash
GET /inner/version
```

响应：

```json
{
  "code": 200,
  "data": {
    "version": "0.2.0"
  }
}
```

## 🔌 作为模块使用

```javascript
const { matchID } = require('@neteasecloudmusicapienhanced/unblockmusic-utils');

// 匹配歌曲（自动选择音源）
const result = await matchID('123456');

// 指定音源
const result = await matchID('123456', 'unm');

console.log(result);
// { code: 200, data: { url: "..." } }
```

## 🎵 支持的音源

| 音源 | 说明 |
|------|------|
| `unm` | UnblockNeteaseMusic 核心音源 |
| `baka` | Baka 音源 |
| `gdmusic` | GDMusic 音源 |
| `msls` | 马赛洛斯音源 |
| `qijieya` | 七界雅音源 |

## ⚙️ 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务监听端口 |
| `NODE_ENV` | - | 运行环境（production/development） |

### 命令行选项

```bash
--port, -p <端口号>    指定服务器端口
--help, -h            显示帮助信息
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 相关项目

- [NeteaseCloudMusicApiEnhanced](https://github.com/NeteaseCloudMusicApiEnhanced) - 增强版网易云音乐 API
- [UnblockNeteaseMusic](https://github.com/UnblockNeteaseMusic/server) - 网易云音乐解锁核心库

---

<div align="center">

Made with ❤️ by NeteaseCloudMusicApiEnhanced

</div>