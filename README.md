# 🎬 Movie Draft & Auction

A real-time, 2-player **Movie Draft & Auction Game** inspired by Telugu cinema and Netflix's sleek UI. Draft 5-movie dream filmographies for top stars like **Nani**, **Allu Arjun**, **Prabhas**, and **Mahesh Babu** with authentic bidding mechanics, the iconic *"Teesko!"* pass rule, live emoji reactions, and instant multiplayer across devices.

![Movie Draft Preview](public/posters/nani/jersey.jpg)

---

## ✨ Features

- 🎮 **Real-time Multiplayer Rooms**: Create a room with a 4-letter code (e.g., `NANI42`), share the 1-click link, and draft live with a friend across two devices or mobile browsers.
- ⚡ **Zero-Config WebRTC / WebSocket Hybrid**: Connects directly via peer-to-peer WebRTC DataChannels (PeerJS) on Vercel / static hosting, with WebSocket support for local & Node servers.
- 📱 **Mobile & Touch Optimized**: Responsive layout with a sticky Mini-HUD displaying live budgets (`₹20`) and slots (`0/5`) without scrolling.
- 🍿 **Authentic Auction Mechanics**:
  - ₹20 budget per player to draft 5 movies.
  - Bid increments (+₹1, +₹2) with authentic sound effects.
  - *"Teesko!"* pass rule to award the film to the high bidder.
  - Auto-claim rules when opponent is full (5/5) or bankrupt (₹0).
- 🤖 **vs AI Mode**: Play solo against an intelligent AI drafter.
- 🎬 **Rich Star Catalog & Posters**: Complete filmographies and HD posters for **Nani** (16 films), **Allu Arjun** (10 films), **Prabhas** (10 films), and **Mahesh Babu** (10 films).
- 🏆 **Final Showdown & Lineup Voting**: Compare final average IMDb scores and vote for the best 5-movie roster.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/vamshicreates/movie-draft.git
cd movie-draft
```

### 2. Install dependencies & Run
```bash
npm install
npm run dev
```

Open [http://localhost:3040](http://localhost:3040) in your browser.

---

## 🚢 Deploy to Vercel

Deploy the repository to Vercel with the **Other** framework preset. The committed
`vercel.json` runs `npm run build` and serves `dist/`, which contains `index.html`,
the JavaScript and CSS, and the posters, sound, and video assets. This explicit
output folder is necessary because Vercel otherwise serves only `public/` when
that directory exists, leaving the homepage at `/` unavailable.

You can deploy through the Vercel dashboard:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Or run:
```bash
npx vercel
```

Vercel hosts the static site; online rooms there use the browser's PeerJS/WebRTC
transport. `npm run dev` uses the Node WebSocket server for local development.

---

## 📜 License
MIT License. Built for cinema lovers.
