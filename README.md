# 🎬 Movie Draft & Auction

A live **Movie Draft & Auction Game** inspired by Telugu cinema. Draft lineups from 22 heroes and 21 heroines with bidding, the *"Teesko!"* pass rule, live emoji reactions, and online rooms across devices.

![Movie Draft Preview](public/posters/nani/jersey.jpg)

---

## ✨ Features

- 🎮 **Online rooms for 2–5 players**: The creator chooses the room size and shares a code or invite link. The lobby shows who has joined, and the draft starts automatically when everyone is connected; the host can also tap Start Movie Draft. The host validates bids and sends a shared room state to every device.
- ⚡ **WebRTC rooms**: PeerJS DataChannels connect players on Vercel and during local development. The host needs to keep their browser tab open for the room to stay available.
- 📱 **Mobile & touch layout**: Online rooms put the film poster and your bidding paddle in focus, with a scrollable lineup strip on small screens.
- 🍿 **Authentic Auction Mechanics**:
  - Choose a ₹20–₹100 starting budget and 5–7 movies per player (defaults: ₹20 and 5).
  - Bid increments (+₹1, +₹2) with authentic sound effects.
  - *"Teesko!"* pass rule to award the film to the high bidder.
  - Auto-claim rules when an opponent is full or bankrupt (₹0).
- 🤖 **vs AI Mode**: Play solo against an intelligent AI drafter.
- 🎬 **43 actor catalogs**: Released lead and substantial co-lead films only. Movies can recur across players when a room needs more picks than the catalog contains. For actors with fewer films than the chosen slot count, films can repeat within a lineup. Local poster files are used where available; a title card fills the remaining gap.
- 🏆 **Shareable results**: Export a portrait image of all lineups for Instagram and ask friends to comment which player drafted best.
- 📣 **Sponsored placements**: Optional home, live draft, waiting room, and results cards. The separate ad manager accepts JPG, PNG, WebP, GIF, or MP4 media, with a strict 10-second MP4 limit. Ads are labeled Sponsored and do not cover the movie poster or bidding controls.

The added film credits were checked against published actor filmographies, including [Nani's](https://en.wikipedia.org/wiki/Nani_filmography), [Allu Arjun's](https://en.wikipedia.org/wiki/Allu_Arjun_filmography), [Samantha Ruth Prabhu's](https://en.wikipedia.org/wiki/Samantha_Ruth_Prabhu_filmography), and [Nagarjuna's](https://en.wikipedia.org/wiki/Nagarjuna_filmography). Cameos, child roles, voice-only work, and unreleased films are excluded. Added poster images were fetched from the corresponding Wikipedia file pages with `scripts/fetch_filmography_posters.py`.

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

### Ad manager setup

1. In the **movie-draft** Vercel project, connect a **public Vercel Blob store**. A public store is needed because published ad media is shown to players. The store uses Vercel OIDC by default; keep `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` connected to Production and Preview.
2. In Project Settings → Environment Variables, create a secret called `AD_ADMIN_PASSWORD` with a strong value of at least 16 characters for **Production and Preview**. Choose and enter this yourself; do not commit it to Git. Redeploy after changing environment variables.
3. Open `/admin.html` on the deployed site and sign in. Upload a file, enter title, description, button text, destination URL, placement, and optional dates. Tick **Publish this ad** and save. Ads are off until published. Changes may take about a minute to appear on new game visits.

Media is capped at 15 MB. MP4 duration is checked in the browser and again by the server before publication. More than one active ad in a placement rotates between page visits. The public game keeps working if ad storage is temporarily unavailable; it simply shows no ads. The local `npm run dev` server does not emulate Vercel Functions, so test the admin workflow on a Vercel deployment or with `vercel dev`.

The **Published ads dashboard** at `/admin.html` shows live, scheduled, paused, and ended campaigns. Sign in with `AD_ADMIN_PASSWORD` to edit or pause ads and refresh outbound click counts. The image, button link, and ad text use separate signed redirect URLs; a click is recorded before opening the advertiser destination. Counts are raw outbound clicks, not unique people or impressions, and begin with this feature's deployment. Video playback controls do not count as outbound clicks. Click events are stored in Vercel Blob without visitor identities; monitor Blob Advanced Operations usage as traffic grows, since each click writes one event.

---

## 📜 License
MIT License. Built for cinema lovers.
