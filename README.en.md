# 🎙️ Funnel Talk

**[🇹🇷 Türkçe](README.md) | [🇬🇧 English](README.en.md)**

A lightweight, self-hosted voice/video chat application for friend groups. Brings Discord's core features (voice channels, screen sharing, soundboard, text chat) to a small friend group on infrastructure you fully control.

<p align="center">
  <img src="assets/funnel-talk-login.png" width="32%">
  <img src="assets/funnel-talk-main.png" width="32%">
  <img src="assets/funnel-talk-screen.png" width="32%">
</p>

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848F)
![License](https://img.shields.io/badge/license-Private-lightgrey)

---

## ✨ Features

**Voice & Video Communication**
- Multiple voice channels, one-click join
- Live preview of who's in a channel before joining
- Screen sharing with quality selection (480p up to 4K, with FPS and bitrate control)
- Opt-in viewing — no one auto-watches a stream, saving bandwidth
- Broadcaster sees who is currently watching
- Fullscreen viewing support

**Audio Quality & Control**
- Per-person volume control (0–300%), independent and persistent for every user
- Volume preferences are tied to a device ID — they survive display-name changes
- Voice activation threshold — automatically gates out low-level background noise
- Limiter — smooths out sudden loud spikes (shouting, mic bumps)
- Noise suppression support
- Microphone/speaker device selection, master volume control

**Soundboard**
- Server-wide shared sound effects
- Playing a sound is only heard by your current channel
- Easy uploads (max 5 seconds, named/emoji-tagged)

**Text Chat**
- Real-time per-channel messaging
- Dedicated text-only channel support

**Personalization**
- 4 themes (Dark, Light, Midnight Blue, Purple)
- Customizable global shortcuts (mute toggle, stop stream) — work even when the app isn't focused
- Google sign-in (optional)
- Session and all preferences persist across restarts

**Infrastructure**
- Auto-update via GitHub Releases
- Runs in the system tray in the background
- Duplicate-name prevention per channel
- Sound effects for join/leave, stream start/stop, and new-viewer notifications

---

## 🏗️ Architecture

```
┌───────────────────┐        ┌──────────────────┐        ┌───────────────────────┐
│  Electron Client  │◄──────►│   LiveKit Cloud  │◄──────►│    Electron Client    │
│    (Windows)      │ WebRTC │  (media server)  │ WebRTC │       (Windows)       │
└─────────┬─────────┘        └──────────────────┘        └───────────┬───────────┘
          │                                                          │
          │                 HTTPS (token request)                    │
          ▼                                                          ▼
     ┌────────────────────────────────────────────────────────────────────┐
     │               Token Server (Raspberry Pi + Tailscale Funnel)       │
     │   • Issues authentication tokens                                   │
     │   • Prevents duplicate names within a channel                      │
     │   • Hosts soundboard audio files                                   │
     └────────────────────────────────────────────────────────────────────┘
```

- **Client (Electron)** — the desktop app installed on each friend's computer. All audio processing (noise suppression, limiting, gating, volume mixing) happens client-side via the Web Audio API.
- **LiveKit Cloud** — the actual carrier of audio/video. A WebRTC-based SFU (Selective Forwarding Unit) that routes media.
- **Token Server** — a small Node.js/Express service running 24/7 on a Raspberry Pi. It only issues short-lived access tokens and hosts soundboard files; no audio/video ever passes through it.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Desktop app | Electron 31 |
| Real-time media | LiveKit (livekit-client / livekit-server-sdk) |
| Token server | Node.js, Express |
| Audio processing | Web Audio API (GainNode, DynamicsCompressor, AnalyserNode) |
| Packaging & distribution | electron-builder, electron-updater |
| Hosting | Raspberry Pi 5 + Tailscale Funnel |
| Authentication | Google OAuth 2.0 (optional) |

---

## 📦 Installation (For Users)

No development environment needed to join a friend group:

1. Download the latest `Funnel-Talk-Setup-X.X.X.exe` from the [Releases](https://github.com/metinncetinn/funnel-talk/releases/latest) page.
2. Double-click to install. If Windows SmartScreen shows a warning, click **"More info" → "Run anyway"** (expected, since the app is unsigned).
3. Open the app, enter your name (or sign in with Google), and click a channel.

Future updates are downloaded automatically in the background; no reinstallation needed.

---

## 🛠️ Setup (Development / Self-Hosting)

This section is for anyone who wants to stand up the whole stack from scratch.

### Prerequisites

- Node.js 18+
- A [LiveKit Cloud](https://cloud.livekit.io) account (free tier is sufficient)
- A server that can stay online 24/7 (a Raspberry Pi or similar) or a cloud alternative
- A GitHub account (for auto-updates)

### 1. LiveKit Cloud Setup

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io).
2. Note down your **API Key**, **API Secret**, and **WebSocket URL**.

### 2. Token Server

```bash
git clone <this-repo>
The token server runs separately from this client repository. In the server project, run `npm install` and create the `.env` file.
cp .env.example .env
```

Fill in `.env`:

```env
LIVEKIT_API_KEY=xxxxx
LIVEKIT_API_SECRET=xxxxx
LIVEKIT_URL=wss://your-project.livekit.cloud
PORT=3001
```

Test it:

```bash
npm start
```

**Running it persistently (Linux / Raspberry Pi, via systemd):**

```bash
sudo cp sesli-oda-token.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sesli-oda-token
sudo systemctl start sesli-oda-token
```

**Exposing it externally (via Tailscale Funnel, recommended):**

```bash
sudo tailscale funnel --bg 3001
```

This gives you a public HTTPS address like `https://your-device.tailxxxx.ts.net` — your friends don't need to install Tailscale.

### 3. Configuring the Electron Client

`renderer/config.js`:

```js
window.APP_CONFIG = {
  TOKEN_SERVER_URL: 'https://your-device.tailxxxx.ts.net',
  CHANNELS: [
    { name: 'General', type: 'voice' },
    { name: 'Gaming', type: 'voice' },
    { name: 'Text Chat', type: 'text' }
  ]
};
```

### 4. Building

```bash
npm install
npm run build
```

The installer will be generated under `dist/`.

### 5. Auto-Updates (optional but recommended)

Fill in the `build.publish` field in `package.json`:

```json
"publish": {
  "provider": "github",
  "owner": "your-username",
  "repo": "your-repo-name",
  "draft": false
}
```

Create a [GitHub Personal Access Token](https://github.com/settings/tokens) (with `repo` scope) to publish:

```bash
$env:GH_TOKEN="ghp_xxxxxxxxxxxx"
npm run release
```

This command builds the app and uploads it directly to GitHub Releases. Installed clients detect the new release in the background and self-update.

### 6. Google Sign-In (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com).
2. Configure the OAuth consent screen as "External".
3. Create an OAuth Client ID of type **Desktop app**.
4. Add the Client ID/Secret at the top of `main.js`:

```js
const GOOGLE_CLIENT_ID = 'xxxxx';
const GOOGLE_CLIENT_SECRET = 'xxxxx';
```

Leaving these blank automatically hides the Google sign-in button.

---

## ⚙️ Configuration Reference

| File | Purpose |
|---|---|
| `renderer/config.js` | Token server address, channel list |
| `main.js` | Google OAuth credentials, window/tray behavior |
| `token-server/.env` | LiveKit credentials |
| `package.json` → `build` | App name, icon, publish (release) settings |

---

## ⌨️ Default Shortcuts

| Action | Default Shortcut |
|---|---|
| Toggle Microphone | `Ctrl+Shift+M` |
| Stop Screen Share | `Ctrl+Shift+S` |

Customizable from Settings → Shortcuts. These shortcuts work globally, even when the app isn't focused.

---

## 🔒 Security Notes

- The token server only issues short-lived (12-hour) LiveKit access tokens; raw API credentials are never sent to the client.
- The `.env` file and LiveKit credentials are not part of this repo — keep `token-server/` separate or excluded via `.gitignore`.
- Google OAuth runs in "testing" mode; only test users you explicitly add can sign in, which is a good fit for small groups without requiring app verification.

---

## 📋 Known Limitations

- Only one person's screen share is shown in the main viewing area at a time.
- Screen sharing can include system audio when the operating system and selected source allow it.
- Text chat is ephemeral (message history clears on leaving/switching channels).
- Currently packaged for Windows only.

---

## 🗺️ Roadmap

- [ ] Persistent chat history
- [ ] Support for watching multiple simultaneous streams
- [ ] Shared music playback via YouTube/link bot
- [ ] macOS/Linux packaging support

---

## 📄 License

This project was built as a private friend-group project.
