# Movie Draft legal review notes

Prepared 8 October 2026. These are implementation facts and decisions for counsel, not published game rules. Public copy is in `legal.html`; the game footer links to each section.

## Operator details to replace

- Current public operator name: **Movie Draft** (temporary).
- Current contact: **MovieDraft@gmail.com** (temporary).
- Confirm the actual legal entity or individual, business address, contact process, jurisdiction and any required grievance contact before final sign-off. Do not infer that “Movie Draft” is an incorporated company.

## Technical inventory checked in this repository

- No player registration, player database, payment form, in-game purchases, wagers, cash prizes, official score, leaderboard or in-game social comments.
- Online room code, star selection, settings, display names, bids, budget, picks, connection state and reactions are exchanged over PeerJS/WebRTC. The room creator's browser owns and broadcasts room state; the live Vercel site does not save match history. The local development server has a separate in-memory WebSocket implementation.
- Guest `sessionStorage` keys `movie-draft-role-${code}` and `movie-draft-name-${code}` assist reconnection. No other first-party browser storage or cookie write was found in the game code. There is no first-use consent/age-verification system.
- The public page loads PeerJS from unpkg, Google Fonts, local and some external film/poster assets, and optional public Vercel Blob ad media. Browser/network requests and provider logs may expose IP or connection details. Confirm service-provider cookie, log, region and retention details separately.
- Admin-entered sponsored media/configuration and one file per raw ad outbound click are stored in Vercel Blob. Click file paths contain a campaign ID, element type and timestamp; the file body is `1`. The game does not append a player ID or name. The application has **no automatic deletion schedule** for those files. Hosting/CDN request logs may contain further data and follow provider practices.
- Result images are generated in browser and shared or downloaded at the player's choice. The site does not receive Instagram comments or votes.

## Items requiring a legal or business decision

1. **Age and children:** The brief specifies 13+. India's Digital Personal Data Protection Act defines a child as under 18, and its child-data provisions have a phased commencement. A simple “I am 13+” checkbox is not a verified-parental-consent mechanism. Decide whether to support 13–17-year-olds, restrict to 18+, add a legally sufficient guardian flow, or use another lawful route before adding a mandatory first-use acknowledgement. Update public age wording accordingly. See the [Act](https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf) and [commencement notification](https://egazette.gov.in/WriteReadData/2025/267647.pdf).
2. **Online-game classification:** The game has no real-money stakes, but counsel should confirm whether any registration, disclosure, grievance or other obligation applies under India's current [Promotion and Regulation of Online Gaming Act, 2025](https://egazette.gov.in/WriteReadData/2025/265615.pdf) and [MeitY's 2026 rules and notifications](https://www.meity.gov.in/documents/act-and-policies/promotion-andregulation-of-online-gaming-act-2025-and-its-corrigenda-kTMxQjMtQWa?pageTitle=Promotionand-Regulation-of-Online-Gaming-Act%2C-2025-and-its-Corrigenda). Do not call the game registered or certified unless it is.
3. **Film and poster rights:** Audit every third-party poster, photograph, logo and externally hosted image for a usable license or permission. A disclaimer and takedown address do not themselves grant display rights. Confirm whether result images may include those posters when users share them.
4. **Advertising:** Confirm approval standards for advertisers, claims, media rights, placement agreements, and ads potentially seen by minors. Sponsored labeling is implemented; India’s [ASCI Code](https://www.ascionline.in/the-asci-code/) also addresses the identification and accuracy of ads.
5. **Data operations:** Confirm Vercel, PeerJS/signaling, unpkg, Google Fonts and image-provider policies; hosting log retention; ad-click retention/deletion; security contact; and any jurisdiction-specific notice or consent requirements. Public privacy wording should be revised if services or tracking change.
6. **User-facing legal acknowledgement:** The attached brief recommends a first-use checkbox. This is not implemented because age and parental-consent treatment needs the decision in item 1. The footer now makes the legal pages and 13+ positioning visible. If a click-through is added later, maintain a versioned record/UX that matches the final legal advice and disclose any storage it uses.

## Keeping the documents current

Review `legal.html` when adding analytics, cookies, accounts, payments, prizes, chat, voting, server-hosted rooms, a new ad SDK, new processors, or a different operator/contact address. Update its effective date and the footer wording when these changes affect the public disclosures.
