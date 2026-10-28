// Pulls official HoYoLAB announcements for each game and records version dates, names, livestreams and
// recent news in data/tracker.json. Runs on a schedule in GitHub Actions; needs Node 20+ and nothing else.
//
//   node scripts/update.mjs              normal run: the newest 50 notices and 50 info posts per game
//   node scripts/update.mjs --pages 12   backfill: read further back through older posts
//
// Only facts from posts are stored. Estimates (like the next version's date before it's announced) are
// worked out by the page, so a wrong guess never ends up in the data.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const GAMES = [
  { key: "genshin", gid: 2 },
  { key: "hsr", gid: 6 },
  { key: "zzz", gid: 8 },
];
const API = "https://bbs-api-os.hoyolab.com/community/post/wapi";
const HEADERS = { "x-rpc-language": "en-us", "User-Agent": "HoyoVersionTracker (github.com/mentalplatypus/HoyoVersionTracker)" };
const DATA = new URL("../data/tracker.json", import.meta.url);
const CACHE = new URL("../data/posts.json", import.meta.url);
const pages = Number(process.argv[process.argv.indexOf("--pages") + 1]) || 1;

// "Version 7.1", "Version "Luna II"", "V3.3", "Ver.4.6"
const VERSION = /(?:\bVersion|\bVer\.|\bV)\s*["“]?(Luna [IVX]+\b|\d+\.\d+)/i;
// posts whose text holds a version's start (and sometimes end) time
const UPDATE_POST = /Update Maintenance Preview|Update and Maintenance Notice|Update Notice|Update Details|Update Announcement/i;
// posts whose subject holds the version's name
const NAMED_POST = /Update Details|Update Announcement/i;
// update posts about one part of a version, whose subjects name that part rather than the version
const SIDE_POST = /Nameless Honor|Event Update|Divergent Universe|Known Issues/i;
// the livestream announcement, not the recap or reminder posts around it
const PROGRAM_POST = /Special Program/i;
const PROGRAM_SIDE_POST = /Brief|Intel Report|Countdown|Keeping Up/i;

// 2026/09/23 06:00 (UTC+8)
const DATE_A = String.raw`(\d{4})/(\d{1,2})/(\d{1,2}) (\d{1,2}):(\d{2}) \(UTC([+-]\d{1,2})\)`;
// 10/23/2026 at 08:00 AM (UTC-4)
const DATE_B = String.raw`(\d{1,2})/(\d{1,2})/(\d{4}) at (\d{1,2}):(\d{2}) ?(AM|PM) \(UTC([+-]\d{1,2})\)`;
// October 9 at 19:30 (UTC+8), with the year taken from the post
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DATE_C = String.raw`(${MONTHS.join("|")}) (\d{1,2}),? (?:(\d{4}),? )?at (\d{1,2}):(\d{2}) \(UTC([+-]\d{1,2})\)`;

const iso = (y, mo, d, h, mi, off) => {
  const t = Date.UTC(+y, +mo - 1, +d, +h, +mi) - Number(off) * 3600e3;
  return new Date(t).toISOString().replace(".000Z", "Z");
};
const dateA = m => iso(m[1], m[2], m[3], m[4], m[5], m[6]);
const dateB = m => iso(m[3], m[1], m[2], (+m[4] % 12) + (m[6].toUpperCase() === "PM" ? 12 : 0), m[5], m[7]);
const dateC = (m, postTime) => {
  const posted = new Date(postTime * 1000), month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  // no year given: it's the post's year, or the next one if that month has already passed
  const year = m[3] || posted.getUTCFullYear() + (month < posted.getUTCMonth() + 1 ? 1 : 0);
  return iso(year, month, m[2], m[4], m[5], m[6]);
};

const START = new RegExp(String.raw`(?:update maintenance (?:on|at)|maintenance begins|maintenance is scheduled to begin on|Update Time Begins at|Update Start Time\]?)\s*` + DATE_A, "i");
const END = new RegExp(String.raw`will run.{0,80}?(?:until|ending on)\s*` + DATE_A, "i");

async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      const json = await res.json();
      if (json.retcode !== 0) throw new Error(`${json.retcode} ${json.message}`);
      return json.data;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

async function listPosts(gid, type) {
  const out = [];
  for (let page = 0; page < pages; page++) {
    const data = await getJSON(`${API}/getNewsList?gids=${gid}&type=${type}&page_size=50&last_id=${page * 50}`);
    out.push(...data.list.map(item => ({ id: item.post.post_id, title: item.post.subject.trim(), time: item.post.created_at, type })));
    if (data.is_last || !data.list.length) break;
  }
  return out;
}

// A post's plain text. Some posts keep it in structured_content (Quill ops) and leave content as a stub.
async function postText(id) {
  const { post: { post } } = await getJSON(`${API}/getPostFull?post_id=${id}&read=1&scene=1`);
  let text = "";
  try { text = JSON.parse(post.structured_content).map(op => typeof op.insert === "string" ? op.insert : " ").join(""); } catch {}
  if (text.trim().length < 40) text = post.content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return text.replace(/\s+/g, " ");
}

const versionOf = title => title.match(VERSION)?.[1].replace(/^luna/i, "Luna");

// Version 4.6 "Dance With the Beast Before Moonrise" …, or for Genshin, "A Rekviem for the Underworld" Version 7.1 Update Details
function nameFrom(title, label) {
  if (!/\bVersion\b/i.test(title) || SIDE_POST.test(title)) return null;
  const quoted = title.match(new RegExp(String.raw`Version\s*["“]?${label}["”]?\s*["“]([^"”]+)["”]`, "i"));
  if (quoted) return quoted[1].trim();
  if (!NAMED_POST.test(title)) return null;
  const name = title
    .replace(new RegExp(String.raw`[:：]?\s*Version\s*["“]?${label}["”]?\s*`, "i"), " ")
    .replace(/\b(Update Details|Update Announcement)\b.*$/i, "")
    .trim().replace(/^[:：\s]+|[:：\s]+$/g, "");
  return name.replace(/^["“](.*)["”]$/, "$1").trim() || null;
}

// Pull what we need out of one post; the result is cached by post id so each post is read only once.
async function parse(post) {
  const label = versionOf(post.title);
  if (!label) return {};
  const found = { label };
  const name = nameFrom(post.title, label);
  if (name) found.name = name;
  if (UPDATE_POST.test(post.title) && !SIDE_POST.test(post.title)) {
    const text = await postText(post.id);
    const start = text.match(START), end = text.match(END);
    if (start) found.start = dateA(start);
    if (end) found.end = dateA(end);
  }
  if (PROGRAM_POST.test(post.title) && !PROGRAM_SIDE_POST.test(post.title)) {
    const text = await postText(post.id);
    const a = text.match(new RegExp(DATE_A)), b = text.match(new RegExp(DATE_B)), c = text.match(new RegExp(DATE_C, "i"));
    const time = a ? dateA(a) : b ? dateB(b) : c ? dateC(c, post.time) : null;
    // the stream is announced a few days ahead; anything else is a different date in the post
    const daysAhead = (Date.parse(time) / 1000 - post.time) / 86400;
    if (time && daysAhead > -1 && daysAhead < 30) found.livestream = time;
  }
  return found;
}

const readJSON = async (url, fallback) => { try { return JSON.parse(await readFile(url, "utf8")); } catch { return fallback; } };

const tracker = await readJSON(DATA, { games: {} });
const before = JSON.stringify({ ...tracker, updated: undefined });
const cache = await readJSON(CACHE, {});
let failures = 0;

for (const game of GAMES) {
  const g = tracker.games[game.key] ??= { versions: [], livestreams: {}, mentions: {}, news: [] };
  let posts;
  try {
    posts = [...await listPosts(game.gid, 1), ...await listPosts(game.gid, 3)];
  } catch (err) {
    console.error(`${game.key}: couldn't list posts, keeping old data. ${err.message}`);
    failures++;
    continue;
  }

  for (const post of posts.sort((a, b) => a.time - b.time)) {
    if (!cache[post.id]) {
      try { cache[post.id] = await parse(post); } catch (err) { console.error(`${game.key} post ${post.id}: ${err.message}`); continue; }
    }
    const f = cache[post.id];
    if (!f.label) continue;
    if (f.start || f.end || f.name) {
      let v = g.versions.find(v => v.label === f.label);
      if (!v) g.versions.push(v = { label: f.label });
      if (f.start) v.start = f.start;
      if (f.end) v.end = f.end;
      if (f.name) v.name = f.name;
      v.post ??= post.id;
    }
    if (f.livestream) g.livestreams[f.label] = { time: f.livestream, post: post.id };
    // when each version was first mentioned; the page uses this to name the next version before it has dates
    const first = new Date(post.time * 1000).toISOString().replace(".000Z", "Z");
    if (!g.mentions[f.label] || first < g.mentions[f.label]) g.mentions[f.label] = first;
  }

  // versions known only by name (announced but not dated yet) go last
  g.versions.sort((a, b) => (a.start || "~").localeCompare(b.start || "~"));
  g.news = posts.sort((a, b) => b.time - a.time).slice(0, 12)
    .map(p => ({ id: p.id, title: p.title, time: new Date(p.time * 1000).toISOString().replace(".000Z", "Z"), kind: p.type === 1 ? "Notice" : "Info" }));
  console.log(`${game.key}: ${g.versions.length} versions, latest ${g.versions.at(-1)?.label}`);
}

if (failures === GAMES.length) process.exit(1);
// only touch the timestamp when something changed, so quiet runs don't make a commit
const { updated, ...facts } = tracker;
if (JSON.stringify(facts) !== before) tracker.updated = new Date().toISOString().replace(/\.\d+Z$/, "Z");
delete tracker.checked;
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(DATA, JSON.stringify(tracker, null, 2) + "\n");
await writeFile(CACHE, JSON.stringify(cache) + "\n");
