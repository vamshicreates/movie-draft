# 🎬 Movie Draft & Auction

A live **Movie Draft & Auction Game** inspired by Telugu cinema. Draft five-film lineups for **Nani**, **Allu Arjun**, **Prabhas**, and **Mahesh Babu** with bidding, the *"Teesko!"* pass rule, live emoji reactions, and online rooms across devices.

![Movie Draft Preview](public/posters/nani/jersey.jpg)

---

## ✨ Features

- 🎮 **Online rooms for 2–5 players**: The creator chooses the room size, shares a code or invite link, and starts once everyone joins. The host validates bids and sends a shared room state to every device.
- ⚡ **WebRTC rooms**: PeerJS DataChannels connect players on Vercel and during local development. The host needs to keep their browser tab open for the room to stay available.
- 📱 **Mobile & touch layout**: Online rooms put the film poster and your bidding paddle in focus, with a scrollable lineup strip on small screens.
- 🍿 **Authentic Auction Mechanics**:
  - ₹20 budget per player to draft 5 movies.
  - Bid increments (+₹1, +₹2) with authentic sound effects.
  - *"Teesko!"* pass rule to award the film to the high bidder.
  - Auto-claim rules when opponent is full (5/5) or bankrupt (₹0).
- 🤖 **vs AI Mode**: Play solo against an intelligent AI drafter.
- 🎬 **Expanded film catalogs**: **Nani** (40 films), **Allu Arjun** (27 films), **Prabhas** (29 films), and **Mahesh Babu** (37 films), including released early roles and cameos. Local poster files are used where available; a title card fills the remaining gap.
- 🏆 **Shareable results**: Export a portrait image of all lineups for Instagram and ask friends to comment which player drafted best.

The added film credits were checked against [Nani's](https://en.wikipedia.org/wiki/Nani_filmography), [Allu Arjun's](https://en.wikipedia.org/wiki/Allu_Arjun_filmography), [Prabhas's](https://en.wikipedia.org/wiki/Prabhas_filmography), and [Mahesh Babu's](https://en.wikipedia.org/wiki/Mahesh_Babu_filmography) published filmographies. Unreleased films and producer-only credits are excluded. Some minor and childhood acting appearances are included so a five-player room has enough distinct films. Added poster images were fetched from the corresponding Wikipedia file pages with `scripts/fetch_filmography_posters.py`.

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

Vercel hosts the static site; online rooms use the browser's PeerJS/WebRTC
transport. `npm run dev` serves the same site locally.

---

## 📜 License
MIT License. Built for cinema lovers.
