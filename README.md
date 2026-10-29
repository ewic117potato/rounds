# Card Clash — Online Multiplayer (1v1)

This is the multiplayer version of the original standalone Card Clash HTML game. The original maps, power-up card draft, physics, bot mode, two-player same-keyboard mode, and menu options are retained.

## What is new

- **Online 1v1** in a private room, using a six-character invite code.
- **Create room / Join room / Copy invite link**; no account or database needed.
- Each player uses their **own keyboard and mouse** to move, jump, block, aim, and shoot.
- **Shared card drafts**: the current player picks on their screen. The host controls match rules before creating the room.
- **Synchronized arena, health, shots, crates, power-ups, round results, and win state**.
- WebSocket game traffic from guest to host is restricted to controls and card choices. The host runs the physics, with 25 state updates per second and ~30 guest input updates per second.
- Leaving a match or disconnecting takes both players back to the main menu.

## Run on your computer

1. Install **Node.js 20 or later**.
2. Open a terminal in this project's folder.
3. Run:

```bash
npm install
npm start
```

4. Open **http://localhost:3000** in your browser. Open a second tab to test with yourself, or share your computer's local IP/port with another device on the same network. Firewalls may need to allow port 3000.
5. Click **Online 1v1** → **Create room**. Your friend opens the same hosted website, clicks **Online 1v1** → **Join room**, and enters the six-character code. Then the host clicks **Start match**.

**Important:** Double-clicking `public/index.html` will still run the offline game, but **online play requires the Node.js server**. GitHub Pages alone cannot host the server.

## Deploy on Render (GitHub)

1. Create a GitHub repository containing the files in this folder.
2. In Render, deploy as a **Node.js web service** (not a static site), connecting your repository.
3. Use the default `render.yaml` blueprint, or configure:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check:** `/healthz`
4. Once deployed, share the same HTTPS game URL with your friend. The game automatically uses **WSS** on HTTPS and **WS** on HTTP.

A different hosting provider is fine if it supports a **persistent Node.js process, WebSockets, and the `PORT` environment variable**. Static-only hosts will not work. A free host that sleeps may interrupt a match.

## Controls

**Online (both players):**
- A / D or ← / →: move
- W or ↑: jump / wall jump
- S or ↓ or Space: block
- Mouse cursor: aim
- Left mouse button or F: shoot
- 1–5 or click: select a card on your turn
- M: mute
- Escape: leave the online room

Offline modes are preserved: single player (against bot) or two players sharing one keyboard.

## Hosting architecture and limits

The first player (room creator) is the **match authority** and runs the original complete physics engine in their browser. The second player sends only controls, gets state snapshots, and sees smooth positional updates. This avoids rewriting the intricate card-effect and collision logic, and is suitable for small friend-vs-friend matches. It is **not** server-authoritative anti-cheat. The match cannot continue if the host closes the browser or disconnects.

No accounts, passwords, database, paid API keys, or personal data are required. Room codes exist only in server memory and are deleted when players leave.

## Verify code

```bash
npm test
```

The bundled tests cover offline mechanics, online lobby, remote controls and shooting, state transfer, card draft turns, room permissions, and disconnect behavior. Live play on a production host still depends on the provider's WebSocket support and network quality.
