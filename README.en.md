<p align="center">
  <img alt="Music Together" src="public/logo.svg" width="80">
</p>

<h1 align="center">Music Together</h1>

<p align="center">
  A real-time collaborative music listening platform — create a room, invite friends, and listen to the same song perfectly synchronized.
</p>

<p align="center">
  <a href="README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/Yueby/music-together/stargazers"><img src="https://img.shields.io/github/stars/Yueby/music-together?style=flat&logo=github" alt="Stars"></a>
  <a href="https://github.com/Yueby/music-together/network/members"><img src="https://img.shields.io/github/forks/Yueby/music-together?style=flat&logo=github" alt="Forks"></a>
  <a href="https://github.com/Yueby/music-together/issues"><img src="https://img.shields.io/github/issues/Yueby/music-together?style=flat&logo=github" alt="Issues"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Yueby/music-together?style=flat" alt="License"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker">
</p>

## Screenshots

### Desktop

|            Home            |            Search            |            Player            |            Chat            |
| :------------------------: | :--------------------------: | :--------------------------: | :------------------------: |
| ![Home](screenshots/1.png) | ![Search](screenshots/2.png) | ![Player](screenshots/3.png) | ![Chat](screenshots/4.png) |

### Mobile

|             Home             |             Search             |             Player             |             Chat             |
| :--------------------------: | :----------------------------: | :----------------------------: | :--------------------------: |
| ![Home](screenshots/1_m.png) | ![Search](screenshots/2_m.png) | ![Player](screenshots/3_m.png) | ![Chat](screenshots/4_m.png) |

### Lyrics Display Comparison

|            Desktop Lyrics            |         Portrait Default (Cover)         |           Portrait Lyrics Mode           |
| :----------------------------------: | :--------------------------------------: | :--------------------------------------: |
| ![Desktop Lyrics](screenshots/3.png) | ![Portrait Default](screenshots/3_m.png) | ![Portrait Lyrics](screenshots/3_m1.png) |

## Features

- **Real-time sync** -- NTP clock synchronization + scheduled execution for minimal latency
- **Multi-platform music sources** -- NetEase Cloud Music, QQ Music, Kugou
- **Apple Music-style lyrics** -- Word-by-word animated lyrics, responsive on desktop and mobile
- **VIP song support** -- Room-scoped cookie pool via platform account login
- **RBAC permissions** -- Owner > Admin > Member with fine-grained access control
- **Temporary admin handoff** -- Non-empty rooms always keep an admin-capable online user
- **Voting system** -- Members vote to control playback actions
- **Play modes** -- Sequential, single loop, list loop, shuffle
- **Real-time chat** -- In-room text messaging with system messages
- **Mobile responsive** -- Adaptive layout with orientation-based switching

## Quick Start

### Prerequisites

- Node.js >= 22
- pnpm >= 10

### Install & Develop

```bash
git clone https://github.com/Yueby/music-together.git
cd music-together
pnpm install
pnpm dev
```

Frontend: http://localhost:5173 | Backend: http://localhost:3001

## Deploy

Single-image Docker deployment:

```bash
docker run -d --name music-together --restart unless-stopped \
  -p 3001:3001 \
  ghcr.io/yueby/music-together:latest
```

> If host port `3001` is already in use, change the left side of `-p <host-port>:<container-port>`, for example `-p 8080:3001`.

In default auto mode, the frontend connects back to the current origin automatically; the server allows all origins and decides whether to set the cookie `Secure` flag based on the incoming request protocol.

**Set `CLIENT_URL` only when you need an explicit origin whitelist:**

```bash
docker run -d --name music-together --restart unless-stopped \
  -p 3001:3001 \
  -e CLIENT_URL=https://music.example.com \
  ghcr.io/yueby/music-together:latest
```

> `CLIENT_URL` is mainly for explicit whitelist mode or separated frontend/backend deployments. In default auto mode, you usually do not need to set it manually.
>
> If you expose HTTPS through Nginx / Caddy / 1Panel / Lucky, make sure the proxy forwards `X-Forwarded-Proto`, or the server cannot auto-detect whether it should issue Secure cookies.

Push to main triggers GitHub Actions to build and push the image. See [Architecture Docs](docs/PROJECT_ARCHITECTURE.md) for details.

## Project Structure

```
packages/
  client/   -- Frontend React application
  server/   -- Backend Node.js service
  shared/   -- Shared types, constants, and permission definitions
```

## Acknowledgements

| Library                                                                                       | Description                   |
| --------------------------------------------------------------------------------------------- | ----------------------------- |
| [Howler.js](https://github.com/goldfire/howler.js)                                            | Web audio playback            |
| [Apple Music-like Lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics)                | Lyrics component (GPL-3.0)    |
| [Meting](https://github.com/metowolf/Meting)                                                  | Multi-platform music API      |
| [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) | NetEase Cloud Music API       |
| [CASL](https://github.com/stalniy/casl)                                                       | Permission management         |
| [Zustand](https://github.com/pmndrs/zustand)                                                  | State management              |
| [shadcn/ui](https://github.com/shadcn-ui/ui)                                                  | UI component library          |
| [Motion](https://github.com/motiondivision/motion)                                            | Animation library             |
| [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next)                                   | Account page layout reference |

## Links

- [LINUX DO](https://linux.do/) -- A community built on sincerity, friendliness, unity and professionalism. This project acknowledges and thanks the LINUX DO community.

## License

[AGPL-3.0](LICENSE)
