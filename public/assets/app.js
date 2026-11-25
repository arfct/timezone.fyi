// Everything the pages do in the browser: the "in 3 h 12 min" line, a card for
// the viewer's own zone, live clocks, the copy button and the link builder.
// No requests after the first load; times come from the browser's Intl.
import { clockText, columnsFor, dateText, relativeText, zoneCard } from "./shared.js";

const MINUTE = 60000;

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
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (mine) {
    const offset = wallAt(mine, event.start).offset;
    const shown = event.zones.some(
      (z) => z.zone === mine || wallAt(z.zone, event.start).offset === offset,
    );
    if (!shown) {
      event.zones.push({
        name: mine.split("/").pop().replace(/_/g, " ").toUpperCase(),
        place: "",
        zone: mine,
        you: true,
      });
    }
  }

  let added = false;
  function draw() {
    const now = Date.now();
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
    } else {
      relative.textContent = relativeText(event.start, event.end, now);
    }
  }

  draw();
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

// Each button and chip takes the colours of the stripe of sky nearest to it:
// the zone beside or under it on an event page, the hour above it on the home
// page. Matched again when the layout changes.
const SKY_VARS = ["--top", "--bottom", "--top-p3", "--bottom-p3", "--on"];
function paintButtons() {
  const skies = [...document.querySelectorAll(".zone, .strip i")].map((el) => ({
    el,
    box: el.getBoundingClientRect(),
  }));
  if (!skies.length) return;
  for (const button of document.querySelectorAll(".btn, .chip")) {
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

colonLift();
const data = document.getElementById("event");
if (data) eventPage(JSON.parse(data.textContent));
copyButton();
const root = document.getElementById("builder");
if (root) builder(root);
