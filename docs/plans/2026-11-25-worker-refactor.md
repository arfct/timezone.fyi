# timezone.fyi as a Cloudflare Worker: proposal and prototype

25 November 2026. Branch `geist/worker-refactor`. Prototype: https://timezone-fyi-proto.arfct.workers.dev

This document is a plan in the repository. No `docs/` site is published from this repo.

## 1. Summary

The prototype serves timezone.fyi from one Cloudflare Worker with static assets. Every URL form the Netlify site accepts still reads the same way, with one exception listed in section 4. Links can now carry a date, a length and a repeat. Each link has a real calendar file at `<link>/event.ics` and a PNG link-preview image at `<link>/card.png`.

What changes for a person using it:

- A link can name a day: `/team-sync/2026-12-03/10am,nyc,lon`. Typing `fri`, `tomorrow` or `dec3` redirects to the link with the date written out.
- A repeating event (`/standup/weekly/2026-03-02/9:30am+15m,nyc,lon`) stays at 9:30 in New York across clock changes, on the page and in the calendar.
- A time typed in 24-hour form is shown in 24-hour form (issue #27).
- The page adds the viewer's own zone and a line such as "in 3h 12m". The live clock ticks in the browser.
- The link-preview image uses Inter and has no missing-glyph boxes. The live site's image for `/10am,nyc,lon,tok`, fetched today, shows boxes in place of every character (`before-og-3zones.jpg` in the screenshots).

What changes underneath: time zone arithmetic uses the runtime's `Intl` data in place of `timezonecomplete` and `tzdata`; the image is an SVG turned into a PNG by the existing `og-svg` Worker in place of node-canvas; the page makes no request to another site.

Nothing in this branch touches the timezone.fyi domain, DNS, or `main`.

## 2. What exists, and its problems

All references are to `origin/main` at fb55dd2.

| Problem | Where |
| --- | --- |
| A time has no date. It is read as today in the first zone at the moment of the request, so the same link means a different instant each day, and its offsets change when clocks change. | `netlify/common.js:143`, `:148`; `netlify/parse-time.js:2` |
| The image is cached by shared caches for a year (`s-maxage=31536000`) though it depends on today's date. | `netlify/functions/og.js:65` |
| The image is a JPEG drawn in Arial, with small-capital letters (`ᴀᴍ`) that most fonts lack. | `netlify/functions/og.js:41`, `:45`, `:63`; `netlify/common.js:173-184` |
| `og:image` is a relative URL, and there is no `og:image:width`, `twitter:card` or canonical link. | `netlify/functions/index.js:82` |
| The viewport forbids zooming (`user-scalable=no`). | `netlify/functions/index.js:75` |
| The calendar file is a `data:` URI built into the page. It has no `UID` or `DTSTAMP`, both required by RFC 5545, and its `PRODID` is the one from the RFC's sample. | `netlify/functions/index.js:52`, `:98` |
| `DTSTART` is in UTC with no zone, and an event with no end is 30 minutes. There is no way to repeat. | `netlify/functions/index.js:43`, `:45` |
| The Google Calendar icon loads from upload.wikimedia.org: a request to a third party from every event page. | `netlify/functions/index.js:95` |
| The live page fetches its whole HTML again every minute: one function call per open tab per minute. | `static/timezone.js:32` |
| A link with zones and no time (`/pst,est`) is rewritten in the browser to the viewer's local clock time, which is then read in the first zone. For a viewer outside that zone the result is not the current time. | `static/timezone.js:14-21` |
| Times are always 12-hour, even when typed as `22:30` (issue #27). | `netlify/common.js:173` |
| The landing page is unstyled text with no way to build a link. | `static/index.html` |
| node-canvas is a native binary tied to the Node version it was installed under. | `README.md` on main, "Node version" note |

One more, found while testing: `timezonecomplete` 5.15.1 with `tzdata` 1.0.54 gives Cairo UTC+2 on 1 July 2026. `tzdata`'s own Egypt rule (summer time from the last Friday of April, 2023 onwards) and `Intl` both give UTC+3. `test/tz.test.js` records this. I did not check the live site for it, because the live site cannot be asked about a July date.

## 3. Architecture

```
request ─▶ static asset?  /assets/*, /robots.txt   ─▶ served by Cloudflare, Worker not run
        └▶ Worker (src/worker.js)
             parse-path → event → page.js      HTML
                                → ics.js       text/calendar   (<link>/event.ics)
                                → card.js SVG ─▶ og-svg (service binding) ─▶ PNG, Cache API   (<link>/card.png)
```

- **One Worker, static assets beside it.** `wrangler.jsonc` sets `run_worker_first` to every path except `/assets/*` and `/robots.txt`. The stylesheet (9,482 bytes), the page script and the icon never run the Worker.
- **No build step.** The Worker is plain ES modules. Wrangler bundles them at deploy. `public/assets/shared.js` (sky colours, time formatting, the zone card's HTML) is imported by both the Worker and the browser, so the two cannot drift.
- **Layout.** `src/lib/` holds parsing and arithmetic with no dependence on Workers; `src/render/` holds the page and the image; `src/worker.js` (192 lines) is routing, caching and headers. `zone-lookup.js`, its collision rules and its tests moved from `netlify/` with their text unchanged.
- **The image goes through og-svg.** `arfct/og-svg` is deployed and working: its `/health` answers `{"ok":true}`, and the prototype calls `env.RENDER.toPng(svg, { width, fonts })` over a service binding. A plain `fetch` between two Workers on workers.dev fails with error 1042, which is what the August branch (`origin/og-svg-renderer`) ran into; the binding avoids it. The prototype sends its own two Inter faces with each call, so og-svg needed no change.
- **Fonts.** `scripts/build-fonts.py` cuts Inter Medium and Bold from the vendored variable font down to Latin, Latin-1, Latin Extended-A and a few punctuation marks: 49,132 and 49,340 bytes. The page itself uses the system font stack and loads no font file. Inter is under the SIL Open Font License; the licence text is in `src/fonts/OFL.txt`.
- **Headers.** Every page carries a Content-Security-Policy of `default-src 'none'` with scripts, styles and images from the site only.

### Intl in place of timezonecomplete and tzdata

| | timezonecomplete + tzdata | Intl (prototype) |
| --- | --- | --- |
| Size in the bundle | 326,259 bytes minified, 57,057 gzipped (esbuild, measured) | 0 bytes of data; `src/lib/tz.js` is 152 lines |
| Who updates the zone rules | Dependabot's monthly pull request, merged by a workflow | Cloudflare, when it updates the runtime |
| Can pin or inspect the data version | Yes | No. The runtime does not report its tzdata version |
| Agreement | | `test/tz.test.js`: 13 zones, every 6 hours through 2026 and 2027, 0 mismatches. Cairo is excluded for the reason in section 2 |

Freshness, measured on the deployed Worker at `/_/runtime` today: 418 zones; `America/Coyhaique` is known (added in tzdata 2025b); Asunción is UTC−3 in July (changed in 2024b); Cairo is UTC+3 in July. So the runtime's data is at least 2025b. How long Cloudflare takes to ship a new tzdata release is not measured. The risk is a country changing its rules at short notice: with the bundled package the fix is a merge, with `Intl` it is a wait. `tzdata` stays as a test-only dependency, so a Dependabot update that disagrees with the runtime fails `npm test` in CI and gets noticed.

### Bundle size

`wrangler deploy` reports a total upload of 410.36 KiB (119.63 KiB gzipped) and a startup time of 5 to 10 ms. Of that, the airport map is 262,112 bytes and the two fonts 98,472 bytes. Cloudflare's limits page, read today, gives 64 MiB uncompressed for a Worker and 1 second for startup. The prototype is 0.63% of the size limit. No WASM is in this Worker; resvg lives in og-svg.

## 4. URL grammar v2

```
/[label/][repeat/][date/]time[-time | +length],zone[,zone…][/event.ics | /card.png]
```

| Part | Forms | Notes |
| --- | --- | --- |
| time | `10am`, `10:30am`, `1030`, `22:30`, `10am-2pm`, `10pm-1am`, `9-17`, `now`, `now24` | unchanged from v1, plus `now24` |
| length | `10am+45m`, `+1h`, `+1h30m`, `+90` | a range wins over a length |
| date | `2026-12-03` | the canonical form |
| | `dec3`, `3dec`, `dec-3`, `december3`, `dec3-2027` | redirects (302) to the ISO form; without a year it is the next such date |
| | `fri`, `friday`, `today`, `tomorrow` | redirects to the ISO form; "today" is today in the first zone |
| repeat | `daily`, `weekdays`, `weekly`, `biweekly` (`fortnightly`), `monthly`, `yearly` (`annually`) | the date is the first occurrence; with no date, redirects to one starting today |
| | `every-mon`, `every-weekday` | redirects to `weekly/<first Monday>` |
| zones | as before | `zone-lookup.js` is unchanged |

Rules that keep a shared link meaning one thing:

- **Relative words never stay in a link.** `/launch/fri/10am,nyc` answers 302 to `/launch/2026-11-27/10am,nyc`. The person copying the link from the address bar copies the dated one.
- **An undated link still means today,** as on the live site. The page labels it "Today", and offers "Pin this date", which is the same link with today's date in it.
- **A repeating event shows its next occurrence.** One still running counts as next.
- **A clock time that does not exist** (02:30 on the night clocks go forward) moves forward by the size of the gap. One that happens twice is the first.

### 24-hour display (#27)

A time written in 24-hour form is shown in 24-hour form in every zone: hour 0, a leading zero, 13 to 23, and no am/pm. `/22:30,pst,cet` shows `22:30 PST · 07:30 CET +1`. `/9-17,lon,nyc` is 24-hour because of the 17. `/10:30,pst` stays `10:30am`, as it always has. `now24` is the live clock in 24-hour form. There is no viewer preference: the link decides, so everyone sees the same thing. That is open decision 4.

### Compatibility

The README's examples and the existing tests pass (`test/parse-path.test.js`, first section; `parse-time`, `resolve-zone`, `day-offset`, `escape` and `airport-map` tests carried over). Differences from the live site:

1. **A label that is exactly a date or repeat word is now read as one.** `/fri/10am,pst` was an event named "fri" and is now Friday. The words are the weekday and month-day forms, `today`, `tomorrow`, and the repeat words. `/friday-sync/10am,pst` is still a label. How many existing links this touches is not known.
2. **`/pst,est` is a live clock** in place of the browser-side rewrite described in section 2.
3. **An event with no end is 60 minutes in the calendar,** not 30. Open decision 5.
4. **The day marker is `+1`,** not the superscript `⁺¹`, in text. The page still sets it small and raised.
5. **`/og?path=…` redirects** (302) to the link's `card.png`.

## 5. Scheduled events and iCal

Every link except a live clock has `<link>/event.ics`, served as `text/calendar` with a filename from the label.

| Field | Value |
| --- | --- |
| `PRODID` | `-//Artifact//timezone.fyi//EN` |
| `UID` | SHA-256 of the start, end, repeat, zone and label, first 32 hex digits, `@timezone.fyi`. The same event written through another zone list, or from another zone, has the same UID, so importing it twice updates the event instead of duplicating it |
| `DTSTAMP` | the time of the request |
| `DTSTART` / `DTEND` | single event: UTC. Repeating event in a named zone: local time with `TZID`. `DTEND` comes from the range or the length, else 60 minutes |
| `RRULE` | `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO`, `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`, `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`, `FREQ=MONTHLY`, `FREQ=YEARLY` |
| `VTIMEZONE` | generated for a repeating event's first zone, from the offsets `Intl` reports |
| `SUMMARY`, `DESCRIPTION`, `URL` | the label (or the first zone's time), every zone's time, and the link |

**Why a repeating event needs TZID.** A weekly 9:30 in New York written as a UTC time would move to 8:30 or 10:30 local when the clocks change. With `TZID=America/New_York` it stays at 9:30. The repeat follows the first zone in the link; the other zones shift for the weeks when their clocks and the first zone's are out of step, which is what happens to the real meeting.

**How the VTIMEZONE is made.** `src/lib/vtimezone.js` finds the zone's offset changes around the event's first date and checks whether they recur on the same "nth weekday of the month" each year. If so it writes a yearly rule (`BYMONTH=3;BYDAY=2SU`). If not (Egypt ends summer time at the end of the last Thursday of October, which no such rule names) it lists each change as its own dated observance. A zone with no changes gets one fixed observance. A repeating event at a fixed offset (`GMT+5:30`) is written in UTC with no VTIMEZONE.

**Subscribing.** A repeating event's page offers `webcal://…/event.ics`. The file carries `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` of one week and the calendar's name. Since the link holds the whole event, a subscription never changes; its value is that the calendar keeps one event with a stable UID.

**Targets on the page.** The "Add to calendar" sheet is a native popover with text rows and no icons:

- Apple Calendar: `event.ics` (and `webcal://` when the event repeats).
- Google Calendar: `calendar.google.com/calendar/render` with `dates`, and for a repeating event `ctz` and `recur`.
- Outlook.com and Outlook for work or school: the compose link. Outlook's form takes no repeat rule, so a repeating event gets Google and the file only.

**Verified.** `test/ics.test.js` reads generated files back with ical.js, using only the VTIMEZONE in the file: New York weekly across both 2026 changes, London, Sydney, Paris daily across the October change, and Cairo. The file fetched from the deployed Worker for `/standup/weekly/2026-03-02/9:30am+15m,nyc,lon` parses to 14:30 UTC on 2 March, 13:30 on 9 March, 13:30 on 26 October and 14:30 on 2 November.

**Not verified.** Importing into Apple Calendar, Google Calendar or Outlook, and the two web links' behaviour when clicked while signed in. ical.js accepting a file is not proof that those three do.

## 6. Visuals

Screenshots, before and after: see the previewer link in the report that came with this branch. The contact sheet is `contact.png`.

**Kept:** the identity. Each zone is a panel filled with the sky gradient for its local hour, from the 24 colour pairs in `netlify/common.js`, now interpolated by the minute.

**Colour:** the sky is drawn in Display P3. `scripts/build-sky-p3.mjs` derives `SKY_P3` from the sRGB pairs: each colour keeps its OKLCH lightness and hue, with chroma raised 30% and then cut back to fit P3. The page uses it through `@supports (color: color(display-p3 …))` and keeps the sRGB pairs as the fallback. The link-preview PNG is drawn with the P3 values and carries a Display P3 ICC profile (iCCP chunk, `src/lib/png-p3.js`, profile CC0 from Compact-ICC-Profiles, 480 bytes). A viewer that ignores the profile shows those values as sRGB, which reads a little more saturated than the sRGB palette.

**Page**

- The page matches the link-preview image: each zone is a full-bleed vertical stripe of its sky gradient, with no gaps, corners or boxes, and the type sits straight on it. A stripe shows the code, the time and the UTC offset (plus the date when it differs); the place name is a tooltip on the code. Text is dark on day skies and light on night skies. One zone fills the width; 5 or 6 sit in threes, 7 or 8 in fours. On a phone up to 3 zones stay side by side as stripes, and more stack as full-width bands.
- Type is the system font (San Francisco on Apple devices) at medium weight. am/pm is one letter set close to the digits (`10:30a`). The colon is centred on the digits as on a clock: the page script measures how far the font in use needs it raised (0.112 em for San Francisco). A range stacks its two ends.
- Gradients run at 135° (top-left to bottom-right), on the page and in the image; `diagonal()` in `src/render/card.js` reproduces CSS's 135deg geometry in SVG so the two match.
- Buttons and chips take their colours from the nearest stripe: the Worker sets the last zone's colours on the page, and `app.js` gives each button the stripe closest to it (on the home page, the hour above it), again whenever the layout changes. A primary button is filled with the gradient; a secondary one is a ring of it. Without either, Quantum's blue.
- No footer on event pages: the stripes run to the bottom of the window, and the only mark is `timezone.fyi` in the last stripe's corner, as in the image.
- The header carries the label, the date line, and "in 3h 12m" / "started 5m ago, 25m left" / "ended 1h ago", computed in the browser.
- The viewer's own zone is added by the page script as a last card marked "Your zone", unless a listed zone already has the same offset at that moment.
- A live clock (`now`, or zones alone) is drawn by the Worker for the request's minute and then kept current by the browser with `Intl`. It makes no further requests.
- Light and dark follow the system setting. The neutral and blue values are Quantum's tokens.
- The landing page has a builder: time, places, date, length, repeat and name fields, quick-add zone chips, and the link written out with Open and Copy buttons. Below it, the grammar and examples.

**Link-preview image** (1200×630 PNG)

- Inter Medium for all text, sent to og-svg with each render (Inter stands in for the system font, which can't be bundled). Inter's contextual alternates centre the colon. Text is fitted with the font's advance widths (`src/fonts/inter-metrics.json`) so nothing overflows a column, and every cell uses the same time size so the times line up.
- am/pm is one lowercase letter at half size, as on the page. Titles, `og:title` and calendar text keep `am`/`pm` in full. `test/render.test.js` checks that every character in eight sample cards and the home card is in the font, and that characters the font lacks (CJK in a label) are dropped before drawing.
- 1 to 4 zones are columns; 5 to 8 are two rows; more than 8 shows 7 and "+N more". A labelled or dated event gets a dark band with the label and date. The day marker is spelled out ("Thu 26 Nov (+1)"). The home image is the 24 hours of stripes with the name set on them, no panel behind it.

**Not done:** an LCD or "clock face" style; the analogue clock icon the old page showed above each zone; any motion.

## 7. Caching

The image's URL says what the image depends on, so a cached copy is always right for its URL.

| Link | Image URL the page advertises | Why |
| --- | --- | --- |
| dated (`/2026-12-03/10am,nyc`) | `…/card.png` | it never changes |
| undated or repeating | `…/card.png?d=2026-11-25` | it changes with the day |
| live | `…/card.png?at=<minute>` | it changes with the minute |

A request for an undated link's `card.png` without `?d=` redirects to the one with today's date. Images are stored with the Cache API under the URL plus a version constant, and sent with `Cache-Control: public, max-age=604800`. og-svg keeps its own cache keyed on the SVG's content.

| Response | Cache-Control |
| --- | --- |
| page for a dated event; home page | `public, max-age=3600` |
| page for an undated, repeating or live link | `no-cache` |
| `event.ics` | `public, max-age=3600` |
| `card.png` | `public, max-age=604800` |
| relative-date redirects | `no-store` |
| errors | `no-store` |
| `/assets/*` | Cloudflare's default for static assets: `max-age=0, must-revalidate` with an ETag |

Three limits:

- The Cache API is per data centre. The first request for an image in each data centre renders it.
- A crawler that cached an old undated link's page keeps that page's `?d=` image. That is correct for what it cached, and stale by the next day, as any preview of "today" is.
- Raising the version constant re-renders images at the Worker, but browsers and crawlers that hold a dated event's image keep it for up to a week.

## 8. Cost

Workers Paid, from Cloudflare's pricing page read today: 10 million requests and 30 million CPU-milliseconds a month are included per account, then $0.30 per million requests and $0.02 per million CPU-ms. Requests for static assets are free. A call over a service binding adds no request charge; the CPU time of both Workers is billed. The included amounts are shared with Artifact's other Workers, whose usage I did not measure.

Measured with `wrangler tail` on the deployed prototype, 6 requests of each kind:

| Request | CPU time |
| --- | --- |
| page | 1 to 5 ms |
| `event.ics` (repeating, with VTIMEZONE) | 3 to 9 ms |
| `card.png`, rendered | 3 to 8 ms in this Worker, plus 58 to 120 ms in og-svg (mean 82 ms) |
| `card.png`, from the cache (1 sample) | 7 ms |

Rendered images were 20,261 to 73,096 bytes. The render's wall time, from the `Server-Timing` header, was 66 to 184 ms.

timezone.fyi's traffic is not measured, so this is a scenario, not a forecast. Take 100,000 page views a month, 100,000 image requests of which 20,000 render, and 10,000 calendar files, each at the worst CPU time sampled:

```
requests   100,000 + 100,000 + 10,000              =   210,000   2.1% of 10,000,000
CPU        pages         100,000 × 5 ms            =   500,000
           images, hit    80,000 × 7 ms            =   560,000
           images, miss   20,000 × (8 + 120) ms    = 2,560,000
           calendar       10,000 × 9 ms            =    90,000
                                                     3,710,000   12.4% of 30,000,000
```

Both are inside the included amounts, so the added cost is $0. Rendering is what costs: at 128 ms each, 234,375 renders a month use the whole 30 million CPU-ms. Past that, a million more renders is 128 million CPU-ms, or $2.56, plus $0.30 for the requests.

Two things the refactor removes: the live page's request per open tab per minute (480 function calls for a tab left open 8 hours; now 0 after load), and per-request work for CSS and script.

What Netlify costs today is not something I can see.

**Exposure.** Any path is a valid image URL, so someone can request unlimited distinct `card.png` URLs at about 128 ms of CPU each. One million such requests would cost up to $2.86 beyond the included amounts. A Cloudflare rate-limiting rule on `*/card.png`, or the account's Workers spending limit, bounds it. Neither is set up by this branch. Open decision 7.

## 9. clock.app

The boundary in clock.app's directions document (section 5) holds: clock.app owns durations and the time here; timezone.fyi owns a clock time somewhere else and one moment in several places. Nothing in this branch modifies clock.app.

### Options

| | A: two sites, shared code | B: one Worker, two hostnames | C: timezone.fyi as a route of clock.app |
| --- | --- | --- | --- |
| Repos | two (clock.app private, timezone.fyi public) | one | one |
| URLs | unchanged | unchanged | timezone.fyi links redirect to `clock.app/…` |
| Deploys | independent | one deploy ships both | one |
| Routing | each Worker as now | branch on hostname; clock.app's Worker today runs only for `/` and `/t`, timezone.fyi's runs for every path | timezone.fyi's free-form paths (`/pst,est`, `/fri/10am,nyc`) share a namespace with `/timer`, `/room`, `/stopwatch` |
| Build | clock.app keeps none; shared files are copied | clock.app gains the airport map and fonts in its bundle | same as B |
| Cost | same | same: the included amounts are per account, so one Worker or two is billed alike | same |
| Link previews | each site's own | each hostname's own | timezone.fyi's previews depend on a redirect being followed |

### Recommendation

This is a recommendation, not a decision: **A**, with cross-links, and the shared code kept as plain files that are copied.

- Merging saves no money, since billing is per account.
- The two sites route in opposite ways. clock.app is static files with a Worker for two paths. timezone.fyi is a Worker for every path. One Worker would have to carry both rules.
- timezone.fyi's paths are whatever a person types. Under C a zone code or a label would collide with clock.app's routes sooner or later.
- timezone.fyi is public and clock.app is private. B and C force one of them to change.
- timezone.fyi links already exist in chats and documents. A keeps them as they are.

B becomes worth revisiting if the two sites start sharing server-side state. Neither has any today.

### What flows each way

| Feature | From → to | How | Status |
| --- | --- | --- | --- |
| Server-time sync | clock.app → timezone.fyi | timezone.fyi's "in 3h 12m" line and live clock trust the device clock. clock.app's `sync.js` and an `X-Server-Time` endpoint would correct it. Each sample is one Worker request, so sync on load only | proposed, not built |
| Zone arithmetic for `?tz=` | timezone.fyi → clock.app | `src/lib/tz.js` has no imports and runs in a browser; `zone-lookup.js` would let `?tz=nyc` work, at the cost of the 262 KB airport map unless only abbreviations and aliases are taken | proposed |
| "Count down to this" | timezone.fyi → clock.app | a link on a dated event's page to `clock.app/timer?end=<UTC instant>&label=<label>`. The instant is already on the page | blocked on clock.app #13: `/timer` does not exist yet, so the prototype has no such link |
| "Show this in other zones" | clock.app → timezone.fyi | from `/timer?end=` or `/room`, a link to `timezone.fyi/<label>/<date>/<time>,utc` | proposed; clock.app #13, #14 |
| Room clock | clock.app | stays on clock.app (#14). A room schedule's entries could link to timezone.fyi event pages | proposed |
| Event pages, calendar files, previews | timezone.fyi | stay on timezone.fyi | built here |
| LCD look | clock.app → timezone.fyi | an optional face for the live clock | not proposed: the ds1.woff2 licence is unconfirmed |
| 12/24-hour | both | clock.app uses `?tf=`; timezone.fyi takes it from how the time is typed. Aligning them is open decision 4 | open |

## 10. Migration from Netlify

Order matters because Netlify builds from `main`, and this branch deletes the Netlify functions.

1. Review the prototype and settle the open decisions.
2. **Nicholas:** in Netlify, stop auto-publishing (lock the current deploy), so that merging cannot break the live site.
3. Merge. Rename the Worker from `timezone-fyi-proto` to `timezone-fyi` in `wrangler.jsonc` and deploy to workers.dev. Add a deploy job to CI on push to `main`, as clock.app has, with `CLOUDFLARE_API_TOKEN` as a repository secret. **Nicholas** adds the secret.
4. Compare the Worker on workers.dev against the live site on real links for a few days.
5. **Nicholas:** attach timezone.fyi to the Worker as a custom domain. DNS is already on Cloudflare; the A record now points at Netlify (75.2.60.5) and is replaced by the custom domain's record. Rolling back is restoring that A record while the Netlify site still exists.
6. After a period with no rollback, delete the Netlify site and the `timezone-fyi-proto` Worker.

Old links keep working: every v1 path form, and `/og?path=` as a redirect. Images that chat apps cached from the old site stay as they are until those apps fetch again.

Also still to do, and not in this branch: `CLAUDE.md` from the org template (issue #26), and updating the catalogue entry in `.artifact/` to describe the new features once they are live.

## 11. Risks

- **Zone data lag.** Section 3. A rule change that reaches `tzdata` before the Workers runtime would be wrong on the site for that interval. The tests would show the disagreement; nothing would fix it but the runtime update, or going back to a bundled table for that zone.
- **og-svg is a dependency.** If it is down or changes its interface, `card.png` fails with an error while pages and calendar files keep working. There is no fallback image.
- **Calendar apps.** Not tested by importing. Section 5.
- **Labels that are date words.** Section 4, difference 1.
- **Render abuse.** Section 8.
- **Viewer-zone card in the screenshots.** The headless browser reports Los Angeles, so every "after" screenshot shows a Los Angeles card where the link does not already include that offset.
- **Canonical URLs on the prototype** use the workers.dev origin. On the real domain they will use timezone.fyi. The UID always uses `@timezone.fyi`.

## 12. Open decisions

1. **Go ahead with the Worker, and with Intl in place of bundled tzdata?** The alternative keeps `timezonecomplete` and `tzdata` in the Worker at 326,259 bytes and keeps the Dependabot path.
2. **clock.app: option A, B or C?** Recommended: A.
3. **Is it acceptable that a label which is exactly a date or repeat word (`fri`, `today`, `weekly`) is now read as that word?** The alternative is a marker for dates, such as `on-fri`, which is safer and longer.
4. **Should 24-hour display be decided only by the link, or also by the viewer** (a toggle, or the browser's locale, or `?tf=` as on clock.app)? The link alone means everyone sees the same thing.
5. **Default length of an event with no end: 60 minutes (prototype) or 30 (live site)?**
6. **Should an undated link stay "today", or redirect to today's date when opened?** Redirecting makes every shared link permanent, and changes what an old undated link shows.
7. **Rate limit or spending limit for `card.png`?** Who sets it up, and at what threshold.
8. **Should the image keep the route through og-svg, or bundle resvg in this Worker?** og-svg keeps this Worker at 410 KiB and shares one renderer; bundling removes the dependency.
9. **Add the "Count down to this" link once clock.app #13 ships?**
10. **Who does the Netlify and domain steps in section 10, and when?**
