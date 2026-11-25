// Everything the pages do in the browser: the "in 3h 12m" line, a card for
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
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.url);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => {
      button.textContent = "Copy link";
    }, 1600);
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
  const open = field("open");
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
    open.href = path;
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

const data = document.getElementById("event");
if (data) eventPage(JSON.parse(data.textContent));
copyButton();
const root = document.getElementById("builder");
if (root) builder(root);
