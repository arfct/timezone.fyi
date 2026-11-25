// Everything the pages do in the browser: the "in 3 h 12 min" line, a card for
// the viewer's own zone, live clocks, the copy button and the link builder.
// No requests to the Worker after the first load; times come from the
// browser's Intl and the sky colours from sun.js.
//
// Opened with `#widget?…` in its address (Quicksilver's web widgets, see
// widget.js), a page draws itself for the widget's size and for the moment
// in the fragment in place of the clock, and lists the moments it changes.
import {
  clockText,
  columnsFor,
  dateText,
  relativeText,
  SKY,
  skyAt,
  skyStyle,
  zoneCard,
} from "./shared.js";
import { sunSky } from "./sun.js";
import {
  fixedTimeline,
  hourlyTimeline,
  isoUtc,
  liveTimeline,
  widgetContext,
  widgetGrid,
  widgetRelative,
} from "./widget.js";

const MINUTE = 60000;

// The widget's context, or null for a page opened normally. Read once here
// and again on each `hashchange` Quicksilver makes for a later moment.
let widget = widgetContext(location.hash);
// The moment the page shows: the widget's date, or now
const moment = () => {
  const ms = widget?.date.getTime();
  return Number.isFinite(ms) ? ms : Date.now();
};
// What draws the page again for a widget's new moment
const redraws = [];

function widgetClasses() {
  const html = document.documentElement;
  for (const c of [...html.classList]) if (c.startsWith("w-")) html.classList.remove(c);
  html.classList.add("widget", `w-${widget.family || "systemMedium"}`);
}

function setMeta(name, content) {
  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
}

// The moments after this one the picture changes, when to draw the page
// again, and what a tap on the widget opens: the page without the fragment
function widgetMeta({ entries, policy }) {
  setMeta("widget-timeline", entries.map(isoUtc).join(", "));
  setMeta("widget-reload-policy", policy);
  setMeta(
    "widget-url",
    document.querySelector('link[rel="canonical"]')?.href ?? location.href.split("#")[0],
  );
}

// Date and clock time of the instant `ms` in `zone` (an IANA name, or minutes
// east of UTC), plus the offset in minutes
function wallAt(zone, ms) {
  let wall;
  if (typeof zone === "number") wall = ms + zone * MINUTE;
  else {
    const parts = {};
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    for (const p of format.formatToParts(ms)) parts[p.type] = p.value;
    wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  }
  const d = new Date(wall);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    offset: Math.round((wall - Math.floor(ms / MINUTE) * MINUTE) / MINUTE),
    dayNumber: Math.floor(wall / 86400000),
  };
}

// The principal place of the browser's own time zone, as { lat, lon }, or
// undefined. The table is a static file, fetched only when a page needs it:
// for the viewer's own card, and for the home page when the Worker couldn't
// place the visitor.
async function myPlace() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const table = (await import("./zone-coords.js")).default;
    const found = table[zone];
    return found ? { lat: found[0], lon: found[1] } : undefined;
  } catch {
    return undefined;
  }
}

function card(z, event, first) {
  const wall = wallAt(z.zone, event.start);
  const view = {
    name: z.name,
    place: z.place,
    you: z.you,
    offset: wall.offset,
    minutes: wall.minutes,
    dayOffset: wall.dayNumber - first.dayNumber,
    dayText: dateText(wall),
    // The sky follows the sun where the zone has a place, the clock otherwise
    sun: z.lat === undefined ? undefined : sunSky(event.start, z.lat, z.lon),
  };
  if (event.end !== undefined) {
    const end = wallAt(z.zone, event.end);
    view.endMinutes = end.minutes;
    view.endDayOffset = end.dayNumber - first.dayNumber;
  }
  return zoneCard(view, event.h24);
}

function eventPage(event) {
  const zones = document.getElementById("zones");
  const relative = document.getElementById("relative");
  const date = document.getElementById("date");

  // A card for the viewer's own zone, unless a listed zone already shows the
  // same time
  // Not in a widget: it has no room for another stripe, and its zones are
  // the ones the link names
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (mine && !widget) {
    const offset = wallAt(mine, event.start).offset;
    const shown = event.zones.some(
      (z) => z.zone === mine || wallAt(z.zone, event.start).offset === offset,
    );
    if (!shown) {
      const you = {
        name: mine.split("/").pop().replace(/_/g, " ").toUpperCase(),
        place: "",
        zone: mine,
        you: true,
      };
      event.zones.push(you);
      // Its colours follow the clock until its place arrives
      myPlace().then((place) => {
        if (!place) return;
        Object.assign(you, place);
        if (event.live) draw();
        else {
          const first = wallAt(event.zones[0].zone, event.start);
          zones.querySelector(".zone.you")?.remove();
          zones.insertAdjacentHTML("beforeend", card(you, event, first));
        }
      });
    }
  }

  let added = false;
  function draw() {
    const now = moment();
    if (event.live) event.start = Math.floor(now / MINUTE) * MINUTE;
    const first = wallAt(event.zones[0].zone, event.start);
    if (event.live) zones.innerHTML = event.zones.map((z) => card(z, event, first)).join("");
    else if (!added) {
      // The Worker drew the listed zones; only the viewer's card is new
      added = true;
      zones.style.setProperty("--cols", columnsFor(event.zones.length));
      zones.classList.toggle("many", event.zones.length > 2);
      for (const z of event.zones.filter((z) => z.you))
        zones.insertAdjacentHTML("beforeend", card(z, event, first));
    }
    if (event.live) {
      date.textContent = dateText(first, true);
      const times = event.zones
        .filter((z) => !z.you)
        .map((z) => `${clockText(wallAt(z.zone, event.start).minutes, event.h24)} ${z.name}`);
      if (!event.labelled) document.title = times.join(" · ");
    } else if (!widget) {
      relative.textContent = relativeText(event.start, event.end, now);
    }
    if (widget) widgetEvent(event, first, now);
  }

  draw();
  if (widget) {
    // A picture doesn't tick: each moment is drawn when Quicksilver asks
    redraws.push(draw);
    return;
  }
  // Redraw at the top of each minute, and when the tab is shown again
  const tick = () => {
    setTimeout(
      () => {
        if (!document.hidden) draw();
        tick();
      },
      MINUTE - (Date.now() % MINUTE) + 50,
    );
  };
  tick();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) draw();
  });
}

// An event in a widget: as many stripes as the family has room for, a line
// with the name or day and how far off it is, and its timeline
function widgetEvent(event, first, now) {
  const zones = document.getElementById("zones");
  const grid = widgetGrid(widget.family, event.zones.length);
  zones.classList.remove("many");
  zones.style.setProperty("--cols", grid.cols);
  zones.dataset.cols = grid.cols;
  zones.querySelectorAll(".zone").forEach((el, i) => {
    el.classList.toggle("w-off", i >= grid.shown);
  });
  document.documentElement.classList.toggle("w-live", !!event.live);

  let caption = document.querySelector(".wcap");
  if (!caption) {
    caption = document.createElement("div");
    caption.className = "wcap";
    caption.innerHTML =
      '<b class="wtitle"></b><span class="wsub"></span><span class="wrel"></span>';
    document.querySelector(".stage").before(caption);
  }
  const heading = document.querySelector(".top h1")?.textContent ?? "";
  const title = event.labelled
    ? heading
    : event.live
      ? "Now"
      : event.floating
        ? "Today"
        : dateText(event.date);
  let sub = "";
  if (event.live) sub = dateText(first, true);
  else if (event.labelled) sub = event.floating ? "Today" : dateText(event.date, true);
  caption.querySelector(".wtitle").textContent = title;
  caption.querySelector(".wsub").textContent = sub;
  caption.querySelector(".wrel").textContent = event.live
    ? ""
    : widgetRelative(event.start, event.end, now).text;

  if (event.live) {
    widgetMeta(liveTimeline(now));
    return;
  }
  // When the Worker would answer with another event: a repeat once this one
  // is over, an undated link at the next midnight in its first zone
  let rollover;
  if (event.recur) rollover = (event.end ?? event.start) + MINUTE;
  else if (event.floating) {
    const wall = wallAt(event.zones[0].zone, event.start);
    rollover = Math.floor(event.start / MINUTE) * MINUTE + (1440 - wall.minutes) * MINUTE;
  }
  widgetMeta(fixedTimeline({ start: event.start, end: event.end, now, rollover }));
}

function copyButton() {
  const button = document.getElementById("copy");
  if (!button) return;
  // Why a copy failed and what to do, beside the button. The link is on the
  // home page to select; on an event page it's in the address bar.
  const note = document.createElement("p");
  note.className = "copy-note";
  note.setAttribute("role", "status");
  button.after(note);
  const fix = document.getElementById("builder")
    ? "Not copied. Select the link and copy it."
    : "Not copied. Copy the link from the address bar.";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.url);
      note.textContent = "";
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy link";
      }, 1600);
    } catch {
      note.textContent = fix;
    }
  });
}

// "Team sync" → "team-sync"; a real hyphen is written "--"
const slug = (label) =>
  label
    .trim()
    .toLowerCase()
    .replace(/-/g, "--")
    .replace(/\s+/g, "-")
    .replace(/[/,.?#]/g, "");

function builder(root) {
  const field = (id) => document.getElementById(`b-${id}`);
  const link = field("link");
  const copy = document.getElementById("copy");

  function update() {
    const time = field("time").value.trim().toLowerCase().replace(/\s+/g, "") || "now";
    const zones = field("zones")
      .value.split(/[\s,]+/)
      .filter(Boolean);
    const parts = [];
    if (field("label").value.trim()) parts.push(slug(field("label").value));
    if (time !== "now") {
      if (field("repeat").value) parts.push(field("repeat").value);
      if (field("date").value) parts.push(field("date").value);
    }
    const length =
      time !== "now" && !time.includes("-") && field("length").value
        ? `+${field("length").value}`
        : "";
    parts.push([time + length, ...zones].join(","));
    const path = `/${parts.map((p) => encodeURI(p).replace(/[?#]/g, encodeURIComponent)).join("/")}`;
    link.textContent = root.dataset.host + decodeURI(path);
    link.href = path;
    copy.dataset.url = location.origin + path;
  }

  root.addEventListener("input", update);
  document.getElementById("b-chips").addEventListener("click", (event) => {
    let zone = event.target.dataset?.zone;
    if (!zone) return;
    if (zone === "mine") zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = field("zones");
    const list = zones.value.split(/[\s,]+/).filter(Boolean);
    if (!list.some((z) => z.toLowerCase() === zone.toLowerCase())) list.push(zone);
    zones.value = list.join(", ");
    update();
  });
  update();
}

// The home page's stripes are each hour of today where the visitor is. The
// Worker draws them when it can place the visitor (data-lat); when it can't,
// they're drawn here for the place of the browser's time zone.
// In a widget they're drawn here for the widget's day, with its hour marked.
async function homeStrip() {
  const strip = document.querySelector(".strip");
  if (!strip || (strip.dataset.lat && !widget)) return;
  const html = document.documentElement;
  // Quicksilver waits for this before it takes the picture
  if (widget) html.setAttribute("data-widget-busy", "");
  const place = strip.dataset.lat
    ? { lat: +strip.dataset.lat, lon: +strip.dataset.lon }
    : await myPlace();
  const draw = () => {
    const now = new Date(moment());
    const stripes = strip.querySelectorAll("i");
    if (place)
      SKY.forEach((_, hour) => {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime();
        stripes[hour].style.cssText = skyStyle(skyAt(hour * 60, sunSky(at, place.lat, place.lon)));
      });
    if (widget) {
      stripes.forEach((el, hour) => {
        el.classList.toggle("w-now", hour === now.getHours());
      });
      strip.dataset.day = dateText(
        {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          weekday: now.getDay(),
        },
        widget.family === "systemLarge",
      );
      widgetMeta(hourlyTimeline(now.getTime()));
    }
    queuePaint();
  };
  draw();
  if (widget) {
    redraws.push(draw);
    html.removeAttribute("data-widget-busy");
  }
}

// How far the system font's colon has to rise to centre on its digits, in em.
// Fonts differ (San Francisco 0.112, others less or none), so it's measured.
function colonLift() {
  const zone = document.querySelector(".zone .time");
  if (!zone) return;
  const style = getComputedStyle(zone);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${style.fontWeight} 1000px ${style.fontFamily}`;
  const middle = (t) => {
    const m = ctx.measureText(t);
    return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  };
  const lift = (middle("0") - middle(":")) / 1000;
  if (Number.isFinite(lift) && Math.abs(lift) < 0.3)
    document.documentElement.style.setProperty("--colon-lift", lift.toFixed(3));
}

// Each button above the stripes takes the colours of the stripe nearest to
// it: the zone under it on an event page, the hour under it on the home page.
// Matched again when the layout changes. Every other button is text colour.
const SKY_VARS = ["--top", "--bottom", "--top-p3", "--bottom-p3", "--on"];
function paintButtons() {
  const skies = [...document.querySelectorAll(".zone, .strip i")].map((el) => ({
    el,
    box: el.getBoundingClientRect(),
  }));
  if (!skies.length) return;
  for (const button of document.querySelectorAll(".top .btn")) {
    const b = button.getBoundingClientRect();
    if (!b.width) continue;
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    let best;
    let bestScore = Infinity;
    for (const s of skies) {
      // Distance from the button's centre to the stripe's box, then how far
      // the centres sit apart sideways, to choose between stripes at an equal
      // distance (the home page's hours all sit the same height above)
      const dx = Math.max(s.box.left - cx, 0, cx - s.box.right);
      const dy = Math.max(s.box.top - cy, 0, cy - s.box.bottom);
      const score = Math.hypot(dx, dy) * 1000 + Math.abs(s.box.left + s.box.width / 2 - cx);
      if (score < bestScore) {
        bestScore = score;
        best = s.el;
      }
    }
    const from = best.style;
    for (const v of SKY_VARS) button.style.setProperty(v, from.getPropertyValue(v));
  }
}
let paintQueued = false;
function queuePaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    paintButtons();
  });
}
new ResizeObserver(queuePaint).observe(document.body);
new MutationObserver(queuePaint).observe(document.body, { childList: true, subtree: true });
document.addEventListener("toggle", queuePaint, true);

if (widget) {
  widgetClasses();
  addEventListener("hashchange", () => {
    const next = widgetContext(location.hash);
    if (!next) return;
    widget = next;
    widgetClasses();
    for (const draw of redraws) draw();
  });
}
colonLift();
const data = document.getElementById("event");
if (data) eventPage(JSON.parse(data.textContent));
copyButton();
const root = document.getElementById("builder");
if (root) builder(root);
homeStrip();
