# HoYo Version Tracker

Tracks version updates for Genshin Impact, Honkai: Star Rail and Zenless Zone Zero on one page. Same graph-paper style as Paper Arcade and the home page: the same design tokens, fonts and light/dark themes. Each game has an accent color: Genshin `--leaf`, Star Rail `--pen`, ZZZ `--win`.

- Repository: https://github.com/mentalplatypus/HoyoVersionTracker (public, branch `main`)
- Live site: https://mentalplatypus.github.io/HoyoVersionTracker/ (GitHub Pages redeploys on every push to `main`)
- Listed under "Ongoing projects" on the home page (`mentalplatypus/mentalplatypus.github.io`, branch `master`). Move it to "Finished projects" when David says it's done.

## Files

- `index.html`: the whole page, no build step. Loads `data/tracker.json` and works out the current version, the next one, countdowns, the timeline and the history in the browser.
- `scripts/update.mjs`: reads HoYoLAB's public news API (`bbs-api-os.hoyolab.com`, game ids 2 Genshin, 6 Star Rail, 8 ZZZ; type 1 notices, 3 info) and writes `data/tracker.json`. Node 20+, no dependencies. `--pages N` reads further back (used once with `--pages 14` to backfill history).
- `data/tracker.json`: facts only, per game: `versions` (label, name, start, sometimes end), `livestreams` by version, `mentions` (when each version label first appeared in a post title), and the 12 newest `news` posts. `updated` changes only when the data does.
- `data/posts.json`: cache of what was parsed from each post id, so each post's full text is fetched once. Delete it to re-parse everything after changing the parsing rules.
- `.github/workflows/update.yml`: runs the script every three hours and commits `data/` if it changed ("Update tracker data" commits from github-actions[bot] are expected).

## How dates are found

- **Start**: the date after "update maintenance on/at", "Update Time Begins at" or "[Update Start Time]" in update posts (Genshin "Update Maintenance Preview", Star Rail "Update and Maintenance Notice" / "Update Details", ZZZ "Update Announcement"). Times are when maintenance begins, 06:00 UTC+8.
- **End**: "will run … until/ending on DATE" (Star Rail and ZZZ state it; Genshin doesn't).
- **Name**: the quoted name after the version in titles, or Genshin's `"Name" Version X Update Details`. Side posts (Nameless Honor, event updates, Divergent Universe, Known Issues) are skipped.
- **Livestream**: the first date in "Special Program" posts, in any of three formats (`2026/10/30 19:30 (UTC+8)`, `10/23/2026 at 08:00 AM (UTC-4)`, `October 9 at 19:30 (UTC+8)`). Recap and reminder posts are skipped.
- Genshin's 6.x versions were named "Luna I" to "Luna VIII" before 7.0; labels are kept as published, and sorting is by start date.

## Estimates (page only, never stored)

A version ends when the next starts, on its announced end date, or 42 days after it starts. The next version's label is the first new label HoYoLAB mentions after the current version starts, or the current one counted up (7.1 → 7.2, Luna VII → Luna VIII). Estimated dates are labeled "Estimated" and drawn dashed on the timeline.

## Testing locally

Node and Python aren't installed on this machine; use a temporary portable Node in the scratchpad to run the script and serve the folder over http (the page fetches JSON, so `file://` won't work). Check light and dark mode and about 375px width before pushing.

## Git workflow (required)

- Commit each logical change as soon as it works, with a short imperative subject line. Push right after. Pull first, since the bot commits data every few hours.
- Run `git status` and `git diff` before committing so only intended files go in.
- Pushes go live immediately, so only push finished, working changes.
- Never force-push or amend pushed commits; revert with a new commit instead.
- Keep `README.md` visitor-facing: the live link and a short description, no editing notes.
