# timezone.fyi as a Cloudflare Worker: proposal and prototype

25 November 2026. Branch `geist/worker-refactor`. Prototype: https://v2.timezone.fyi (also https://timezone-fyi-proto.arfct.workers.dev)

This document is a plan in the repository. No `docs/` site is published from this repo.

## 1. Summary

The prototype serves timezone.fyi from one Cloudflare Worker with static assets. Every URL form the Netlify site accepts still reads the same way, with one exception listed in section 4. Links can now carry a date, a length and a repeat. Each link has a real calendar file at `<link>/event.ics` and a PNG link-preview image at `<link>/card.png`.

What changes for a person using it:

- A link can name a day: `/team-sync/2026-12-03/10am,nyc,lon`. Typing `fri`, `tomorrow` or `dec3` redirects to the link with the date written out.
- A repeating event (`/standup/weekly/2026-03-02/9:30am+15m,nyc,lon`) stays at 9:30 in New York across clock changes, on the page and in the calendar.
- A time typed in 24-hour form is shown in 24-hour form (issue #27).
- The page adds the viewer's own zone and a line such as "in 3 h 12 min". The live clock ticks in the browser.
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
- **An undated link still means today,** as on the live site. The page labels it "Today", and offers "Link to this date", which is the same link with today's date in it.
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

**Kept:** the identity. Each zone is a panel filled with the sky gradient, from the 24 colour pairs in `netlify/common.js`, now interpolated by the minute. Which part of the gradient a zone gets follows the sun where the zone is, not its clock: section 13.

**Colour:** the sky is drawn in Display P3. `scripts/build-sky-p3.mjs` derives `SKY_P3` from the sRGB pairs: each colour keeps its OKLCH lightness and hue, with chroma raised 30% and then cut back to fit P3. The page uses it through `@supports (color: color(display-p3 …))` and keeps the sRGB pairs as the fallback. The link-preview PNG is drawn with the P3 values and carries a Display P3 ICC profile (iCCP chunk, `src/lib/png-p3.js`, profile CC0 from Compact-ICC-Profiles, 480 bytes). A viewer that ignores the profile shows those values as sRGB, which reads a little more saturated than the sRGB palette.

**Page**

- The page matches the link-preview image: each zone is a full-bleed vertical stripe of its sky gradient, with no gaps, corners or boxes, and the type sits straight on it. A stripe shows the code, the time and the UTC offset (plus the date when it differs); the place name is a tooltip on the code. Text is dark on day skies and light on night skies. One zone fills the width; 5 or 6 sit in threes, 7 or 8 in fours. On a phone up to 3 zones stay side by side as stripes, and more stack as full-width bands.
- Type is the system font (San Francisco on Apple devices) at medium weight. am/pm is one letter set close to the digits (`10:30a`). The colon is centred on the digits as on a clock: the page script measures how far the font in use needs it raised (0.112 em for San Francisco). A range stacks its two ends.
- Gradients run at 135° (top-left to bottom-right), on the page and in the image; `diagonal()` in `src/render/card.js` reproduces CSS's 135deg geometry in SVG so the two match.
- Buttons and chips take their colours from the nearest stripe: the Worker sets the last zone's colours on the page, and `app.js` gives each button the stripe closest to it (on the home page, the hour above it), again whenever the layout changes. A primary button is filled with the gradient; a secondary one is a ring of it. Without either, Quantum's blue.
- No footer on event pages: the stripes run to the bottom of the window, and the only mark is `timezone.fyi` in the last stripe's corner, as in the image.
- The header carries the label, the date line, and "in 3 h 12 min" / "started 5 min ago, 25 min left" / "ended 1 h ago", computed in the browser. From 48 hours it counts calendar days in the viewer's zone ("in 8 days").
- The viewer's own zone is added by the page script as a last card marked "Your zone", unless a listed zone already has the same offset at that moment.
- A live clock (`now`, or zones alone) is drawn by the Worker for the request's minute and then kept current by the browser with `Intl`. It makes no further requests.
- Light and dark follow the system setting. The neutral and blue values are Quantum's tokens.
- The landing page has the tagline ("Share your time with friends across zones.") under the stripes, then the grammar and examples. A "Make a link" button above the stripes opens the builder as a dialog: time, time zones, date, length, repeat and name fields, quick-add zone chips, and the link written out with a Copy link button.
- Only the buttons above the stripes are coloured, each with the gradient of the stripe nearest it. Every other button and chip is text colour.

**Link-preview image** (1200×630 PNG)

- Inter Medium for all text, sent to og-svg with each render (Inter stands in for the system font, which can't be bundled). Inter's contextual alternates centre the colon. Text is fitted with the font's advance widths (`src/fonts/inter-metrics.json`) so nothing overflows a column, and every cell uses the same time size so the times line up.
- am/pm is one lowercase letter at half size, as on the page. Titles, `og:title` and calendar text keep `am`/`pm` in full. `test/render.test.js` checks that every character in eight sample cards and the home card is in the font, and that characters the font lacks (CJK in a label) are dropped before drawing.
- 1 to 4 zones are columns; 5 to 8 are two rows; more than 8 shows 7 and "+N more". A labelled or dated event gets a dark band with the label and date. The day marker is spelled out ("Thu 26 Nov (+1)"). The home image is the 24 hours of stripes as drawn, for no place and no season, with the name and the tagline set on them, no panel behind it.

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
| page for a dated event | `public, max-age=3600` |
| home page | `private, max-age=3600` when the Worker can place the visitor (section 13), else `public, max-age=3600` |
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
| Server-time sync | clock.app → timezone.fyi | timezone.fyi's "in 3 h 12 min" line and live clock trust the device clock. clock.app's `sync.js` and an `X-Server-Time` endpoint would correct it. Each sample is one Worker request, so sync on load only | proposed, not built |
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
2. Stop Netlify from building `main`, so that merging cannot break the live site. Done in the repo: `netlify.toml` now holds only `ignore = "exit 0"`, which tells Netlify to skip every build (Netlify's "Ignore builds" docs), so the last published deploy keeps serving. Locking the deploy in Netlify's dashboard as well is a second guard.
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
11. **Section 13: are the polar colours right, and should GMT have a place?** A polar noon in twilight is a blend of the dawn blue and the dusk pink; a midnight sun stays yellow. GMT and bare offsets follow the clock.
12. **Section 13: may a home page that carries the visitor's rounded coordinates be sent `private`?** The alternative is a second request.

## 13. The sky follows the sun

Nicholas asked for the gradient to show the true state of the sun at each place: Reykjavik at 9pm is orange in June and night in December. The code is `public/assets/sun.js`, shared by the Worker and the browser, with no dependencies. The screenshots are in the previewer link that came with this change.

### The sun's position

`solar(ms)` gives the sun's declination and the equation of time from the date, with the low-precision method NOAA's solar calculator uses (Meeus, Astronomical Algorithms, chapter 25). `sunAt(ms, lat, lon)` adds the hour angle and gives the elevation. `sunEvents(ms, lat, lon)` gives the day's solar noon, sunrise and sunset (sun's centre 0.833° below the horizon) and civil dawn and dusk (6° below), and says when the day is a polar day or a polar night.

Accuracy: checked against PyEphem 4.2, an independent ephemeris, for 20 place-days in 2026 (New York, London, Reykjavik, Singapore, Tromsø, Sydney and Longyearbyen at equinox and solstices). Every event was within 6 seconds, and the elevation at 12:00 UTC within 0.006°. Each polar day and polar night was reported as one. `test/sun.test.js` holds the reference values and fails beyond 30 seconds. I did not compare against NOAA's own calculator page.

### Where a zone is

Best first (`src/lib/coords.js`):

1. **A place with its own coordinates.** Every airport and city code (9,291) has its latitude and longitude from lxndrblz/Airports, the source the zone map already uses. A city code without a row of its own takes the mean of its airports. Nine nicknames (`sf`, `tok`, `cam` and others) are set by hand. So `sea` and `lax` share a zone and have different skies.
2. **The zone's principal place.** For zone names, and for abbreviations through the zone they stand for (`pst` is Los Angeles, `jst` is Tokyo, `cet` is Paris). The table is 549 names from the time zone database's `zone.tab`, `zone1970.tab` and `backward` files.
3. **The place that stands for an offset.** `gmt`, `utc`, bare offsets (`gmt+5:30`, `utc-3`), `Etc` zones and abbreviations that only name an offset (`ndt`) take the latitude where most people on that offset live. See section 15. In the first version these had no place and kept the clock's colours.
4. **Nothing.** An offset nobody keeps (`gmt+7:15`) has no place, so its stripe keeps the clock's colours.

Coordinates are rounded to 0.1°, about 11 km, which the sun crosses in 24 seconds. `scripts/build-coords.mjs` writes both tables and does not touch the zone map.

**Principal city or a true average?** Nicholas wrote "the average for that zone". The database's rule is that a zone's principal place is its most populous city, so it is where the largest share of the zone's people are. A population-weighted mean would need zone boundaries and a population grid at build time (tens of megabytes), and for a wide zone it can land between cities, where few people live. No single point is right for a zone that spans 20° of latitude; a city or airport code is the way to be exact. I kept the principal city. The table is 16,804 bytes.

### From the sun to the gradient

This is the first version, with one palette hour for both colours and blends in sRGB. Section 14 replaces it and keeps its marks.

The 24 colour pairs stay as Nicholas tuned them. A place and an instant pick a palette hour by the sun, in a straight line between these marks:

| Sun | Palette hour |
| --- | --- |
| solar midnight | 0 |
| civil dawn (6° below) | 5.5 |
| sunrise | 6.5 |
| solar noon | 12 |
| sunset | 18.5 |
| civil dusk (6° below) | 19.5 |
| solar midnight | 24 |

**Events, not elevation alone.** Elevation alone can't tell morning from evening, and the palette has different colours for each. It would also paint a London winter noon, with the sun 15° up, in late-afternoon orange. With the marks above, every day runs through the whole palette in order, stretched or squeezed to the day's length.

**The reference day.** At 40° north at the March equinox the palette hour stays within 0.85 hours of the clock's (mean 0.21), so that day looks as the clock-based page did. The largest gap is just after civil dusk, which the sun reaches at 18:31 and the marks put at 19.5.

**When the sun misses a mark.** The end of the line is then set by how high or low the sun gets that day. A noon sun under 30° stops short of the full midday colours (London in December peaks at palette hour 10.4 before noon and 13.9 after). A midnight sun less than 30° down stops short of full night. In polar night the noon colours are twilight or night, by how far down the sun is; in polar day, once the midnight sun is 2° up, the midnight colours stay in the day's range (palette hours 9 to 15.5). Morning and evening colours then meet without passing through midday or midnight, so one fades into the other around that moment, over up to six hours either side. Tromsø at noon on 21 December is half dawn blue and half dusk pink. The colours never jump: across a year at ten latitudes, no channel moves more than 28 of 255 in five minutes (a test).

Two weak spots in this first version, both fixed in section 14. For a few days either side of the polar night, with the noon sun between the horizon and 2°, the blend of morning teal and evening orange was a dull olive for about an hour. And a white night (Reykjavik in June at midnight) was a greyish mauve.

### Where it applies

- **Event pages.** The Worker computes each zone's sun at the event's start and paints the stripe. A range is coloured by its start, as before.
- **Live clocks and the viewer's card.** The page's data carries each zone's `lat` and `lon`, and `app.js` uses the same `sun.js`. The viewer's own zone has no entry in the page, so the script fetches the zone table (`/assets/zone-coords.js`, a static file) the first time it needs it.
- **Buttons** copy the nearest stripe, so they follow.
- **Link-preview images.** Same sun, computed in the Worker. The image's URL already carries the date or minute, so cached images stay right. The cache version is now 10.
- **Calendar files** are unaffected.
- **The home image** stays the clock's 24 hours.

### The home page and the visitor's place

The 24 stripes are each hour of today where the visitor is. The Worker reads `request.cf.latitude`, `longitude` and `timezone`, Cloudflare's reading of the request's address: city level, no permission prompt. It rounds them to 0.1°, draws the stripes, and writes the coordinates on the strip (`data-lat`, `data-lon`). Without coordinates it uses the principal place of `cf.timezone`. Without either, the page is the clock's hours and the browser redraws the stripes for the principal place of its own time zone. The browser's geolocation prompt is never used.

**Caching.** A page drawn for one visitor's place must not be served to another. The home page is sent `Cache-Control: private, max-age=3600` when it carries a place, so the visitor's browser keeps it and no shared cache may. This costs nothing today: the Worker already runs for every home request, and HTML is not stored with the Cache API. If the home page is ever cached at the edge, the place has to move out of it, into a small uncached `/sun.json` that the script fetches. That adds a request per visit, which is why I did not do it now.

### Cost

Local timing in Node, per call: one `sunSky` is 0.2 microseconds. An event page is 0.095 ms before and after. The home page went from 0.04 to 0.06 ms.

On the deployed prototype with `wrangler tail`, the previous commit and this one each deployed and measured twice, about 10 to 24 requests of each kind per run:

| Request | Before, median CPU (two runs) | After |
| --- | --- | --- |
| event page | 3.5 and 1 ms | 3 and 2 ms |
| `card.png`, rendered (this Worker only) | 6 and 4.5 ms | 6 and 3 ms |
| home page | 1 and 1 ms | 3 and 1.5 ms |

The runs differ from each other by more than the change does. For event pages and images I can't measure a difference. The home page may cost about 1 ms more.

Bundle, from `wrangler deploy`: 416.98 KiB (121.94 KiB gzipped) before, 507.28 KiB (175.69 KiB) after. Most of the 90 KiB is the airport coordinates, 65 KiB as one packed string searched by halving. Startup time was reported as 5 to 9 ms across deploys of both versions. The browser loads `sun.js` (8.7 kB) with every page, and the zone table only when it needs the viewer's place.

### Not verified

- No comparison with NOAA's calculator page itself, and no dates outside 2026.
- The browser path was checked in headless Chrome only, with its zone reported as Los Angeles.
- `request.cf` coordinates were seen for one address (this Mac's). A request with no `cf.latitude` was only exercised through the browser fallback on a local copy of the page.

## 14. Top and bottom placed separately, and a glow through short working days

Nicholas asked for the two gradient colours to be chosen independently, for a slight glow along the bottom from 8 to 6 where daylight is short (Sweden in winter), for every gradient to show a colour shift, and for that shift to be between adjacent hues only. The code is `public/assets/sky.js`, one module that the Worker bundles and the browser loads. `shared.js` re-exports it.

### The model

The top is the upper sky. The bottom is the light along the horizon. Each has its own ramp: the 24 anchor tops in order, and the 24 anchor bottoms in order. The anchors are unchanged, and with no place (an offset nobody keeps) each clock hour is its anchor pair exactly.

1. **Top.** The sun's events put the top on its ramp as in section 13: the marks hold at civil dawn, sunrise, solar noon, sunset and civil dusk, and the hour angle runs in a straight line between them. Morning and evening are separate sides of the ramp.
2. **Bottom.** The same, for a sun 1.5° higher than it is. The horizon is lit from further round the Earth than the sky overhead, so it brightens before the top at dawn and holds its light after it at dusk. In New York at the equinox that is about 8 minutes.
3. **Blending.** Colours are held as OKLCH. Between two neighbouring anchors a colour moves in a straight line through OKLab. Where morning and evening colours meet away from full midday or full night (a winter noon, polar night, a white night), one fades into the other around that moment. If the two are within 70° of hue the fade is a straight line (two yellows at a London winter noon). If not, the hue is led round the wheel through blue, violet and pink, the hues the dusk anchors pass through, and never through green or grey. The choice is made once per noon or midnight, from the top's colours, for both layers.
4. **Glow.** See below.
5. **Distinction and hue rules.** See below. They are applied last, to the bottom only.
6. **Display P3.** Each colour is written in sRGB and again in P3 with the same lightness and hue and up to 1.3 times the chroma, as far as P3 holds it. This is worked out per colour, so the `SKY_P3` table and `scripts/build-sky-p3.mjs` are gone. The P3 values for the anchors are within 0.002 of the old table (a test).

### The working-hours glow

In local clock time from 08:00 to 18:00, with 45 minutes of soft edge outside each end, the bottom moves toward a plum glow: the bottom ramp at palette hour 20.4, between the 8pm and 9pm anchors, about `#763e83`. It is the last warm light in the dusk family, light enough to see and dark enough for white text.

Strength is set by the day's length, sunrise to sunset. Ten hours or more gives none, so that daylight covers the working day. Four hours or fewer gives the full 0.85. In between it is a straight line. Stockholm on 21 December has 6.1 hours and gets 0.55. Tromsø in polar night gets 0.85. New York's shortest day is 9.25 hours and gets 0.11 at most, which moves the bottom by less than an eye picks out. Singapore gets none on any day (a test over the whole year).

The glow only brightens. It fades out as the bottom's own lightness comes within 0.12 of the glow's, so it shows while the sun is down and adds nothing in daylight or in a bright dusk. The top is never touched.

What that looks like on 21 December:

| Place and time | Top | Bottom without glow | Bottom with glow |
| --- | --- | --- | --- |
| Stockholm 08:00, sun 4.7° down | `#056f9b` | `#042c47` | `#463c77` |
| Stockholm 08:30 | `#097ea8` | `#06405d` | `#4c4483` |
| Stockholm 10:00, sun 4.4° up | `#64c9ca` | `#1587a7` | the same |
| Stockholm 15:00, just after sunset | `#c45788` | `#f38e65` | the same |
| Stockholm 18:00 | `#262868` | `#5f357d` | `#6b3a80` |
| Tromsø 08:00, sun 11° down | `#145289` | `#203051` | `#714181` |
| Tromsø 12:00, sun 3° down | `#7d6cba` | `#98719f` | the same |
| Tromsø 17:30, sun 21° down | `#15245c` | `#362173` | `#773e82` |

Nicholas's brief gave Stockholm at 10:00 and 15:00 as examples of the glow. On that date the sun is up at 10:00 and the dusk is still orange at 15:00, so the bottom is already brighter than the glow and stays as it is. In Stockholm the glow shows from about 07:30 to 09:15 and from 17:45 to 18:45. In Tromsø it shows from 07:30 to 09:45 and from 16:30 to 18:45.

**Text.** `dark` (light text) is decided on the colour halfway between the top and the bottom as drawn, glow included: light text when white has more contrast against it than the dark text colour. Across a year at 21 latitudes in 5-minute steps the chosen text colour always has at least 3:1 against that middle (a test).

### Distinction and adjacent hues

- **Minimum distinction.** Top and bottom are at least 0.06 apart in OKLab. That is the least among the anchors (9pm), so no anchor is changed. A bottom that is closer is moved straight away from the top to that distance. A bottom at the edge of sRGB is then pulled back inside, which can cost up to 0.006: the least measured is 0.0545. The first version's least was 0.016.
- **Adjacent hues.** Top and bottom are at most 90° apart in OKLCH hue. The widest anchor pair is 88° (9am, cream over aqua). A bottom further round is turned back toward the top's hue. A colour with chroma under 0.04 has no hue to speak of and the rule lets go of it, fully at 0.02. The widest measured is 91.4°, the extra from rounding a pale colour to 8 bits. The first version's widest was 98.4°.
- **Over time.** Every blend is between neighbours on a ramp or goes round the wheel by a set way, so a colour never passes through grey. In the same sweep the first version had 3,766 olive, 13,699 mauve and 13,986 grey colours of 4.4 million. This one has none. The bands are in `test/sky.test.js`: olive is hue 80° to 140° with lightness under 0.72, mauve is hue over 290° with chroma under 0.06 and middling lightness, grey is chroma under 0.03 with middling lightness.
- **No jumps.** The most any colour moves in 5 minutes is 0.059 in OKLab, which is the anchors' own fastest step, at dusk. The first version's was 0.067.

### Parameters

All in `SKY_MODEL` in `sky.js`, each with a comment.

| Name | Value | Meaning |
| --- | --- | --- |
| `marks` | −30° is 0 and 24, −18° is 4 and 21, −6° is 5.5 and 19.5, −0.833° is 6.5 and 18.5, 2° is 9 and 15.5, 30° is 12 | Palette hour for the sun's height, morning and evening. Used where a day's noon or midnight stops short of full midday or full night. |
| `horizonLead` | 1.5° | The bottom is coloured for a sun this much higher. |
| `meetSpan` | 90° of hour angle (6 hours) | The longest fade between morning and evening colours either side of a noon or midnight where they don't meet. Shorter the nearer they meet to full midday (by the square) or full night (in proportion). |
| `dayWayWithin` | 70° | A fade goes in a straight line when the two colours are within this much hue, and round through blue, violet and pink when not. |
| `hazeFrom`, `hazeDepth`, `hazeLight` | 70°, 0.3, 0.86 | A long fade round the wheel loses up to 30% of its chroma in the middle and lifts toward lightness 0.86, so a white night is a pale violet and not a neon one. |
| `workFrom`, `workTo` | 08:00, 18:00 | Working hours, local clock time. |
| `workRamp` | 45 min | Soft edge outside each end. |
| `glowHour` | 20.4 | The glow's colour: the bottom ramp at this palette hour. |
| `glowStrength` | 0.85 | The most the bottom moves toward the glow. |
| `glowNoneAt`, `glowFullAt` | 10 h, 4 h | Day length at which the glow is none, and full. |
| `glowSoft` | 0.12 | The glow fades out as the bottom's own lightness comes within this of the glow's. |
| `minDistinction` | 0.06 | Least OKLab distance between top and bottom. |
| `maxHueGap` | 90° | Most hue between top and bottom. |
| `neutralChroma` | 0.04 | Below this a colour is let off the hue rule. |
| `p3Chroma` | 1.3 | Chroma gain in Display P3. |

### How close the reference day stays

New York on 20 March 2026, each local hour, against the first version: no top moved more than 0.007 in OKLab and no bottom more than 0.026. Neighbouring anchors are 0.05 to 0.2 apart. The test allows 0.015 and 0.04.

### Where it applies

Everything that drew a sky calls `skyAt(minutes, sun)`: event page stripes, the live clocks and the viewer's card in `app.js`, the buttons (they copy a stripe), the home page's 24 stripes for the visitor's place, and the link-preview image. The image's cache version is 11. `skyAt` now needs the local clock time as well as the sun, for the glow.

### Cost

Local timing in Node, 400,000 calls: `sunSky` and `skyAt` together took 1.98 microseconds before and 2.55 after. `skyAt` by the clock took 1.45 before and 1.66 after. An event page with four zones spends about 2 microseconds more. I did not repeat the `wrangler tail` measurement: the change is three orders of magnitude under what that could show in section 13.

Bundle, from `wrangler deploy`: 507.28 KiB (175.69 KiB gzipped) before, 515.59 KiB (178.89 KiB) after. Worker startup was reported as 4 ms. In the browser `sky.js` is 19.7 kB before compression and `shared.js` went from 10.6 to 5.7 kB.

### Not verified

- The look was checked in headless Chrome screenshots, which are sRGB. I have not seen the P3 colours on a P3 display.
- The glow's colour and strength are my choice from the anchors. Nobody has looked at them in a real Swedish winter.
- The southern hemisphere was covered by the tests' sweep (to 70° south) and not by screenshots.

## 15. A place for each bare offset

Nicholas asked that a time zone with no latitude of its own take the latitude where most of the people in its strip live, worked out one offset at a time. This applies to `gmt`, `utc`, bare offsets, `Etc` zones, and abbreviations that only name an offset. They used to keep the clock's colours. Now `gmt` in December has a short northern day and `utc-3` has a southern summer.

`scripts/build-offset-coords.mjs` writes `src/data/offset-coords.json` (40 offsets, about 1 kB). For each offset on its own:

1. **The strip** is every city whose time zone has that offset as its standard time in 2026, the smaller of its January and July offsets. I used standard time and not the current offset, so the table does not change with the season. An offset that zones keep only in summer (−02:30, +13:45) takes the cities on it then. An offset no zone keeps (−12:00) takes the cities within 7.5° of its meridian, offset times 15°. A zone with no city in the data (the Line Islands, the Marquesas) counts as one person at its principal place, so it only decides a strip that is otherwise empty.
2. **The latitude.** City populations are added up in 1° bins of latitude, and each bin is counted with its two neighbours. The bin with the most is the peak. The latitude is the population-weighted median of the cities in the peak bin and its neighbours.
3. **The longitude** is the population-weighted median of the same cities. Both are rounded to 0.1°.

Cities are GeoNames `cities15000` (https://download.geonames.org/export/dump/cities15000.zip, CC BY 4.0), fetched on 2026-11-25: every city of 15,000 people or more with its time zone. The script downloads it and does not keep it.

| Offset | Latitude | Longitude | Largest city in the peak band | Strip |
| --- | --- | --- | --- | --- |
| −12:00 | -36.8 | 174.8 | Auckland, NZ | longitude band |
| −11:00 | -14.3 | -170.7 | Pago Pago, AS | standard time |
| −10:00 | 21.3 | -157.9 | Honolulu, US | standard time |
| −09:30 | -9 | -139.5 | Pacific/Marquesas (the zone's own place, no city in the data) | standard time |
| −09:00 | 61.2 | -149.9 | Anchorage, US | standard time |
| −08:00 | 33.9 | -117.9 | Los Angeles, US | standard time |
| −07:00 | 33.3 | -111.8 | Phoenix, US | standard time |
| −06:00 | 19.4 | -99.1 | Mexico City, MX | standard time |
| −05:00 | 40.8 | -74 | New York City, US | standard time |
| −04:00 | 10.2 | -67.5 | Caracas, VE | standard time |
| −03:30 | 47.6 | -52.7 | St. John's, CA | standard time |
| −03:00 | -23.4 | -46.6 | São Paulo, BR | standard time |
| −02:30 | 47.6 | -52.7 | St. John's, CA | summer time only |
| −02:00 | 64.2 | -51.7 | Nuuk, GL | standard time |
| −01:00 | 14.9 | -23.5 | Praia, CV | standard time |
| +00:00 | 51.8 | -1 | London, GB | standard time |
| +01:00 | 51.4 | 8.3 | Berlin, DE | standard time |
| +02:00 | 31.1 | 31.2 | Cairo, EG | standard time |
| +03:00 | 41 | 28.9 | Istanbul, TR | standard time |
| +03:30 | 35.7 | 51.4 | Tehran, IR | standard time |
| +04:00 | 25.1 | 55.3 | Dubai, AE | standard time |
| +04:30 | 34.5 | 69.2 | Kabul, AF | standard time |
| +05:00 | 31.6 | 73.7 | Lahore, PK | standard time |
| +05:30 | 22.6 | 79.1 | Ahmedabad, IN | standard time |
| +05:45 | 27.7 | 85.3 | Kathmandu, NP | standard time |
| +06:00 | 23.7 | 90.4 | Dhaka, BD | standard time |
| +06:30 | 16.8 | 96.2 | Yangon, MM | standard time |
| +07:00 | -6.7 | 107.6 | Jakarta, ID | standard time |
| +08:00 | 30.7 | 117.3 | Shanghai, CN | standard time |
| +08:45 | -31.7 | 128.9 | Australia/Eucla (the zone's own place, no city in the data) | standard time |
| +09:00 | 35.5 | 137.2 | Tokyo, JP | standard time |
| +09:30 | -34.9 | 138.6 | Adelaide, AU | standard time |
| +10:00 | -37.8 | 145 | Melbourne, AU | standard time |
| +10:30 | -31.5 | 159.1 | Australia/LHI (the zone's own place, no city in the data) | standard time |
| +11:00 | 47 | 142.7 | Yuzhno-Sakhalinsk, RU | standard time |
| +12:00 | -36.8 | 174.8 | Auckland, NZ | standard time |
| +12:45 | -43.9 | -176.5 | NZ-CHAT (the zone's own place, no city in the data) | standard time |
| +13:00 | -13.8 | -171.8 | Apia, WS | standard time |
| +13:45 | -43.9 | -176.5 | NZ-CHAT (the zone's own place, no city in the data) | summer time only |
| +14:00 | 1.9 | -157.3 | Pacific/Kiritimati (the zone's own place, no city in the data) | standard time |

Things to know when reading the table:

- **00:00 is southern England, not West Africa.** The strip is the British Isles, Portugal, Iceland and West Africa from Senegal to Ghana. London's band has 50.1 million people with its neighbours, more than any band on the West African coast. Nigeria is on +01:00.
- **+01:00 is Germany's latitude** (51.4° north): the band from the Netherlands to Poland holds 83 million, more than the band of Lagos.
- **+05:30 is 22.6° north**, the band of Kolkata and Ahmedabad across the middle of India, and the longitude between them. That is south of Delhi.
- **+08:00 is 30.7° north, 117.3° east**: the Yangtze band of eastern China, Shanghai's.
- **Summer time moves several strips.** Counting every city that is on an offset at any time of year, −04:00 would be New York and not Caracas, +02:00 Berlin and not Cairo, +03:00 Cairo and not Istanbul. The script prints both. Standard time is what a bare offset most often means.
- **+11:00 is Sakhalin** and +13:00 is Samoa. Few people keep these as standard time. With summer time counted they would be Melbourne and Auckland.
- An abbreviation with a zone of its own keeps that zone's place: `wet` is Lisbon, `jst` is Tokyo.

Tests: every offset any zone keeps in 2026 and every whole hour from −12:00 to +14:00 has an entry, half and quarter hours included, and each is within 30° of its own meridian. The bundle grew from 515.59 to 517.22 KiB.

## 16. The pages as Quicksilver widgets

Nicholas asked that the prototype work as a web widget in Quicksilver for iPhone (arfct/alchemy, `docs/web-widgets.md`). Quicksilver loads the page in a hidden web view at the widget's size, with the widget's context in the fragment, waits for it to settle, and takes a picture. It takes one more picture for each later date the page lists, changing only the fragment.

What the page does with `#widget?…` in its address, and only then:

- **The moment.** Everything that read the clock reads the fragment's `date`: the live clock's times, the sky colours, the day markers, the "in 3 h" line and the home page's hours. The minute timer does not run. Each `hashchange` redraws at once, without a request.
- **The layout.** The stripes fill the widget. Small: two zones side by side, or the first alone when there are more. Medium: up to four. Large: up to four side by side or six in two rows, under the event's name and day. Lock Screen: a white line for each of up to three zones, with no gradients. A dated event has a line with its name or day and how far off it is. The buttons, the calendar sheet and the `timezone.fyi` mark are hidden, so the whole widget opens the page. The background is transparent where the stripes don't reach.
- **The timeline.** A live clock lists the next 24 minutes, each on the minute, and asks to be drawn again after the last (`atEnd`). Each picture shows its entry's minute, so the clock is exact for 24 minutes and then stays on its last minute until Quicksilver draws it again. Nicholas chose one-minute pictures over five-minute ones on 2026-11-25; Quicksilver's picture memory is being reduced to fit them. The widget shows only the zones in the link, not the viewer's own (also his decision). A dated event's line is coarser than the page's so it can be kept right: calendar days changing at midnight beyond 48 hours, whole hours beyond one hour, then five-minute steps. The timeline lists each moment the line changes, up to 24, then `atEnd`. A past event asks for `never`. A repeating event stops at its end and an undated one at the next midnight in its first zone, since the Worker then answers with another event. The home page lists the next 24 hours.
- **The limit.** The cap is `MAX_ENTRIES` (25 pictures with now) in `public/assets/widget.js`. Quicksilver keeps 12 today and drops the latest dates beyond that. Every timeline ends in `atEnd` while anything is left to change, so a cut-short timeline is drawn again after its last kept picture: today a live clock covers 55 minutes, with 25 it covers two hours.
- **Settling.** Nothing polls. The page uses the system font and no images. The viewer's own zone is not added in a widget, so no table is fetched. The home page fetches the zone table only when the Worker could not place the visitor, and marks itself `data-widget-busy` while it does.

Checked in headless Chrome with a harness that copies the renderer: the page at the widget's exact size and scale, the renderer's settle script word for word with a 12 second deadline, the timeline read as the renderer reads it, and each later entry drawn by setting `location.hash`. The first settle took 0.5 to 1 second and each later entry 0.1 to 0.4 seconds. An event page opened without the fragment matched the screenshot taken before the change to within one level in one colour channel.

Not verified: the pages have not been drawn by Quicksilver itself, in the iOS simulator or on an iPhone, and Chrome is not WebKit.

