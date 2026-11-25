// The HTML for an event page, a live clock and the home page.
import {
  columnsFor,
  dateText,
  escapeHtml,
  SKY,
  skyAt,
  skyStyle,
  zoneCard,
} from "../../public/assets/shared.js";
import { calendarLinks, DEFAULT_DURATION } from "../lib/ics.js";

const SITE = "timezone.fyi";
const TAGLINE = "Share your time with friends across zones.";

// JSON inside a <script> element: "<" can't start a tag or close the element
const jsonScript = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// in: { title, description, url, image, imageAlt, bodyClass, body, extraHead }
function document({
  title,
  description,
  url,
  image,
  imageAlt,
  bodyClass = "",
  bodyStyle = "",
  body,
  extraHead = "",
}) {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(image)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/app.css">
<script type="module" src="/assets/app.js"></script>${extraHead}
</head>
<body class="${bodyClass}"${bodyStyle ? ` style="${bodyStyle}"` : ""}>
${body}
</body>
</html>
`;
}

// The time segment with a length added: "10am" → "10am+30m"
const withDuration = (event, minutes) =>
  event.path.replace(/\/([^/,]*)(,.*)$/, (_, time, zones) => `/${time}+${minutes}m${zones}`);

function calendarPanel(event, origin) {
  const e = escapeHtml;
  const pageUrl = origin + event.path;
  const links = calendarLinks(event, pageUrl);
  const ics = `${event.path}/event.ics`;
  const rows = [
    `<a class="row" href="${e(ics)}" download><b>Apple Calendar</b><span>.ics file</span></a>`,
    `<a class="row" href="${e(links.google)}" target="_blank" rel="noopener noreferrer"><b>Google Calendar</b></a>`,
  ];
  if (links.outlook) {
    rows.push(
      `<a class="row" href="${e(links.outlook)}" target="_blank" rel="noopener noreferrer"><b>Outlook.com</b></a>`,
      `<a class="row" href="${e(links.office)}" target="_blank" rel="noopener noreferrer"><b>Outlook for work or school</b></a>`,
    );
  }
  if (event.recur) {
    const webcal = `webcal://${origin.replace(/^https?:\/\//, "")}${ics}`;
    rows.push(
      `<a class="row" href="${e(webcal)}"><b>Subscribe</b><span>Adds a calendar that updates from this link</span></a>`,
    );
  }
  let length = "";
  if (event.duration === undefined) {
    const choices = [15, 30, 45, 60, 90]
      .map(
        (m) =>
          `<a class="chip" href="${e(withDuration(event, m))}"${m === DEFAULT_DURATION ? ' aria-current="true"' : ""}>${m < 60 ? `${m} min` : m === 60 ? "1 h" : "1 h 30 min"}</a>`,
      )
      .join("");
    // No sentence about the default: its chip is the one shown as selected
    length = `<p class="hint" id="length-label">Length</p><p class="chips" role="group" aria-labelledby="length-label">${choices}</p>`;
  }
  const floating = event.floating
    ? `<p class="hint">The event is on ${e(dateText(event.date, true))}.</p>`
    : "";
  return `<div id="calendar" class="sheet" popover>
<h2>Add to calendar</h2>
${floating}${rows.join("\n")}
${length}
<button class="btn" popovertarget="calendar" popovertargetaction="hide">Close</button>
</div>`;
}

// in: a resolved event, the request's origin, and the image URL
export function eventPage(event, origin, image) {
  const e = escapeHtml;
  const url = origin + event.path;
  const label = event.label ? capitalise(event.label) : "";

  // Unlabelled: the times are the title. Labelled: the label, with the day.
  const when = event.live ? "Live clock" : event.floating ? "" : event.dateText;
  const title = label ? (when ? `${label} · ${when}` : label) : event.timesText;
  const description = label ? event.timesText : when || "For today, whenever the link is opened";

  const cards = event.zones
    .map((z) =>
      zoneCard(
        {
          name: z.name,
          place: z.place,
          offset: z.offset,
          minutes: z.minutes,
          endMinutes: z.endMinutes,
          dayOffset: z.dayOffset,
          endDayOffset: z.endDayOffset,
          dayText: dateText(z.wall),
        },
        event.h24,
      ),
    )
    .join("\n");

  // The heading is the label; without one it's the day. The line under it
  // carries whatever the heading doesn't: the day, how it repeats, a link that
  // pins an undated link to today, and (from the browser) how far off it is.
  const longDate = event.live ? "" : dateText(event.date, true);
  const heading = label || (event.live ? "Now" : event.floating ? "Today" : longDate);
  let dateLine;
  if (event.live) dateLine = `<span id="date"></span>`;
  else if (event.floating) {
    const pinned = event.path.replace(/\/([^/,]*,.*)$/, `/${event.dateIso}/$1`);
    dateLine = `<span id="date">${label ? "Today, " : ""}${e(longDate)}</span> <a class="pin" href="${e(pinned)}">Link to this date</a>`;
  } else if (event.recur)
    dateLine = `<span id="date">${e(label ? event.dateText : event.recurText)}</span>`;
  else dateLine = `<span id="date">${label ? e(longDate) : ""}</span>`;

  const data = {
    live: event.live,
    labelled: !!label,
    h24: event.h24,
    start: event.start,
    end: event.end,
    date: event.live ? undefined : event.date,
    zones: event.zones.map((z) => ({ name: z.name, place: z.place, zone: z.zone })),
  };

  const body = `<header class="top">
<div class="what">
<h1>${e(heading)}</h1>
<p class="when">${dateLine}<span id="relative" aria-live="polite"></span></p>
</div>
<nav class="actions">
${event.live ? "" : `<button class="btn primary" popovertarget="calendar">Add to calendar</button>`}
<button class="btn" id="copy" data-url="${e(url)}">Copy link</button>
</nav>
</header>
<div class="stage">
<main id="zones" class="zones${event.zones.length > 2 ? " many" : ""}" style="--cols:${columnsFor(event.zones.length)}">
${cards}
</main>
<a class="mark" href="/">${SITE}</a>
</div>
${event.live ? "" : calendarPanel(event, origin)}
<script type="application/json" id="event">${jsonScript(data)}</script>`;

  const extraHead = event.live
    ? ""
    : `\n<link rel="alternate" type="text/calendar" href="${e(`${event.path}/event.ics`)}" title="Calendar file">`;
  return document({
    title,
    description,
    url,
    image,
    imageAlt: `${label ? `${label}: ` : ""}${event.timesText}`,
    bodyClass: event.live ? "live" : "event",
    // Until app.js matches each button to its nearest stripe, they take the
    // last zone's colours: the stripe under the top-right corner
    bodyStyle: skyStyle(skyAt(event.zones[event.zones.length - 1].minutes)),
    body,
    extraHead,
  });
}

const EXAMPLES = [
  ["/10:30am,pst,est", "Two zones"],
  ["/2pm,JFK,LHR,NRT", "Airport codes"],
  ["/team-sync/2026-12-03/10am-11:30am,nyc,lon,tok", "Name, date, end time"],
  ["/standup/every-mon/9:30am+15m,nyc,lon", "Every Monday, 15 minutes"],
  ["/fri/14:00,par,sf", "Next Friday, 24-hour"],
  ["/now,cst,pst", "Live clock"],
];

// The home page, with the link builder. `error` explains a link that didn't
// parse.
export function homePage(origin, error) {
  const e = escapeHtml;
  const strip = SKY.map((_, hour) => `<i style="${skyStyle(skyAt(hour * 60))}"></i>`).join("");
  const examples = EXAMPLES.map(
    ([path, what]) =>
      `<li><a href="${e(path)}"><code>${e(path)}</code></a><span>${e(what)}</span></li>`,
  ).join("\n");
  const host = origin.replace(/^https?:\/\//, "");
  const body = `<header class="top home-top">
<nav class="actions">
<button class="btn primary" popovertarget="builder">Make a link</button>
</nav>
</header>
<main class="home">
<header class="hero">
<div class="strip">${strip}<h1>${SITE}</h1></div>
<p class="lede">${TAGLINE}</p>
</header>
${error ? `<p class="error" role="alert">${e(error)}</p>` : ""}
<div class="sheet builder" id="builder" popover data-host="${e(host)}">
<h2>Make a link</h2>
<div class="fields">
<label class="f-time">Time<input id="b-time" value="10:30am" autocomplete="off" spellcheck="false" placeholder="10:30am"></label>
<div class="f-zones"><label>Time zones<input id="b-zones" value="pst, nyc, lon" autocomplete="off" spellcheck="false" placeholder="pst, nyc, lon" aria-describedby="b-zones-help"></label><p class="help" id="b-zones-help">The time is in the first zone</p></div>
<label class="f-date">Date<input id="b-date" type="date"></label>
<label class="f-length">Length<select id="b-length"><option value="">Not set</option><option value="15m">15 min</option><option value="30m">30 min</option><option value="45m">45 min</option><option value="1h">1 h</option><option value="1h30m">1 h 30 min</option><option value="2h">2 h</option></select></label>
<label class="f-repeat">Repeats<select id="b-repeat"><option value="">Never</option><option value="daily">Every day</option><option value="weekdays">Every weekday</option><option value="weekly">Every week</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Every month</option></select></label>
<label class="f-label">Name<input id="b-label" autocomplete="off" placeholder="Team sync"></label>
</div>
<p class="chips" id="b-chips"><button type="button" class="chip" data-zone="mine">Your zone</button>${["pst", "est", "utc", "lon", "par", "ist", "sin", "tok", "syd"].map((z) => `<button type="button" class="chip" data-zone="${z}">${z.toUpperCase()}</button>`).join("")}</p>
<div class="result">
<a id="b-link" class="link" href="/10:30am,pst,nyc,lon">${e(host)}/10:30am,pst,nyc,lon</a>
<button type="button" class="btn" id="copy" data-url="${e(origin)}/10:30am,pst,nyc,lon">Copy link</button>
</div>
<button class="btn" popovertarget="builder" popovertargetaction="hide">Close</button>
</div>
<section class="guide">
<h2>Link format</h2>
<ul class="examples">
${examples}
</ul>
<dl>
<dt>Zones</dt><dd>Abbreviations (<code>pst</code>, <code>cet</code>, <code>ist</code>), airport codes (<code>jfk</code>, <code>lhr</code>), city codes (<code>nyc</code>, <code>lon</code>, <code>tok</code>), names (<code>Europe/Paris</code>) and UTC offsets (<code>gmt+5:30</code>). The time is in the first zone.</dd>
<dt>Times</dt><dd><code>10am</code>, <code>10:30pm</code>, <code>1030</code>, <code>14:00</code>, <code>9-5</code>, <code>10pm-1am</code>, <code>10am+45m</code>. <code>14:00</code> makes the whole page 24-hour. <code>now</code> is a live clock.</dd>
<dt>Dates</dt><dd><code>2026-12-03</code>, <code>dec3</code>, <code>fri</code> or <code>tomorrow</code>, before the time. With no date, the link is for today whenever it's opened.</dd>
<dt>Repeats</dt><dd><code>daily</code>, <code>weekdays</code>, <code>weekly</code>, <code>biweekly</code>, <code>monthly</code>, or <code>every-mon</code>, before the date. The event keeps its time in the first zone when clocks change.</dd>
<dt>Names</dt><dd><code>/team-sync/10am,nyc,lon</code> is titled Team sync.</dd>
</dl>
</section>
<footer class="foot"><a href="https://artifact.com">Artifact</a><a href="https://github.com/arfct/timezone.fyi">Source</a></footer>
</main>`;
  return document({
    title: error ? `Couldn't read the link · ${SITE}` : `${SITE}: ${TAGLINE}`,
    description: `A link like ${host}/10am,nyc,lon shows 10am New York time in each zone listed, on the page and in the link preview.`,
    url: `${origin}/`,
    image: `${origin}/card.png`,
    imageAlt: `${SITE}: ${TAGLINE}`,
    bodyClass: "landing",
    // Mid-morning sky until app.js matches each button to its nearest stripe
    bodyStyle: skyStyle(skyAt(9 * 60)),
    body,
  });
}
