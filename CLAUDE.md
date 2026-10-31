# HoYo Version Tracker

Tracks version updates and redeem codes for Genshin Impact, Honkai: Star Rail and Zenless Zone Zero on one page. Uses the Dusk theme shared with the home page (see its CLAUDE.md): a soft gradient background, translucent rounded cards, Bricolage Grotesque headings and Inter text, in light and dark. Graph paper is reserved for Paper Arcade. Each game has an accent color: Genshin `--leaf`, Star Rail `--pen`, ZZZ `--win`.

Has the site-wide light/dark switch (top right; see the home page CLAUDE.md). The timeline redraws on the `themechange` event.

- Repository: https://github.com/mentalplatypus/HoyoVersionTracker (public, branch `main`)
- Live site: https://mentalplatypus.github.io/HoyoVersionTracker/ (GitHub Pages redeploys on every push to `main`)
- Listed under "Finished projects" on the home page (`mentalplatypus/mentalplatypus.github.io`, branch `master`), above Paper Arcade; David marked it finished on 2026-10-28. The data workflow keeps running.

## Files

- `index.html`: the whole page, no build step. Loads `data/tracker.json` and works out the current version, the next one, countdowns, the timeline and the history in the browser.
- `scripts/update.mjs`: reads HoYoLAB's public news API (`bbs-api-os.hoyolab.com`, game ids 2 Genshin, 6 Star Rail, 8 ZZZ; type 1 notices, 3 info) and writes `data/tracker.json`. Node 20+, no dependencies. `--pages N` reads further back (used once with `--pages 14` to backfill history).
- `data/tracker.json`: facts only, per game: `versions` (label, name, start, sometimes end), `livestreams` by version, `mentions` (when each version label first appeared in a post title), the 12 newest `news` posts, and `codes` (see Redeem codes). `updated` changes only when the data does.
- `data/posts.json`: cache of what was parsed from each post id, so each post's full text is fetched once. Delete it to re-parse everything after changing the parsing rules.
- `.github/workflows/update.yml`: runs the script every hour (since 2026-10-30, for livestream codes; it was every three hours) and commits `data/` if it changed ("Update tracker data" commits from github-actions[bot] are expected).

## Redeem codes (added 2026-10-30)

- **Source**: the community hoyo-codes API (`https://hoyo-codes.seria.moe/codes?game=genshin|hkrpg|nap`, github.com/seriaati/hoyo-codes). It gathers codes from HoYoLAB and fan sites and checks each by redeeming it; only `status: "OK"` codes are kept, so expired ones drop off by themselves. Its `rewards` field is either `Item*N;Item*N` (rewritten as `Item ×N, …`) or prose (kept as written).
- **Official livestream codes**: HoYoLAB's guide module (`bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material?game_id=2|6|8`, `data.modules[].exchange_group.bonuses[].exchange_code`) lists them while a special program is on; it's empty the rest of the time. Codes found there are added even if hoyo-codes hasn't picked them up yet.
- Each code: `code`, `rewards`, `seen` (when this script first saw it; kept across runs), and `livestream` (version label) when it's a livestream code: first seen from 2 hours before to 48 hours after a recorded livestream, or listed in the guide module. On a game's first run (no `codes` yet) only codes giving exactly 100 of the premium currency (the livestream-code pattern) are tagged by timing.
- If hoyo-codes fails, the old list is kept.
- The page shows a card per game, livestream codes first with a note that they usually stop working about a day after the stream, plus Copy and Redeem buttons. Redeem opens the official page with the code filled in: `genshin.hoyoverse.com/en/gift?code=`, `hsr.hoyoverse.com/gift?code=`, `zenless.hoyoverse.com/redemption?code=`. The game card's Livestream row links to the codes ("· 3 codes") while that livestream's codes still work.

## How dates are found

- **Start**: the date after "update maintenance on/at", "Update Time Begins at" or "[Update Start Time]" in update posts (Genshin "Update Maintenance Preview", Star Rail "Update and Maintenance Notice" / "Update Details", ZZZ "Update Announcement"). Times are when maintenance begins, 06:00 UTC+8.
- **End**: "will run … until/ending on DATE" (Star Rail and ZZZ state it; Genshin doesn't).
- **Name**: the quoted name after the version in titles, or Genshin's `"Name" Version X Update Details`. Side posts (Nameless Honor, event updates, Divergent Universe, Known Issues) are skipped.
- **Livestream**: the first date in "Special Program" posts, in any of three formats (`2026/10/30 19:30 (UTC+8)`, `10/23/2026 at 08:00 AM (UTC-4)`, `October 9 at 19:30 (UTC+8)`). Recap and reminder posts are skipped.
- Genshin's 6.x versions were named "Luna I" to "Luna VIII" before 7.0; labels are kept as published, and sorting is by start date.

## Estimates (page only, never stored)

A version ends when the next starts, on its announced end date, or 42 days after it starts. The next version's label is the first new label HoYoLAB mentions after the current version starts, or the current one counted up (7.1 → 7.2, Luna VII → Luna VIII). Estimated dates are labeled "Estimated" and drawn dashed on the timeline.

## Testing locally

Node.js is installed (`C:/Program Files/nodejs`, since 2026-10-31; Python isn't). Use it to run the script and serve the folder over http (the page fetches JSON, so `file://` won't work). Check light and dark mode and about 375px width before pushing.

## Git workflow (required)

- Commit each logical change as soon as it works, with a short imperative subject line. Push right after. Pull first, since the bot commits data every few hours.
- Run `git status` and `git diff` before committing so only intended files go in.
- Pushes go live immediately, so only push finished, working changes.
- Never force-push or amend pushed commits; revert with a new commit instead.
- Keep `README.md` visitor-facing: the live link and a short description, no editing notes.
