// timezone.fyi as a Cloudflare Worker. Reads the link in the path and answers
// with the page, its link-preview image (…/card.png) or its calendar file
// (…/event.ics). Stylesheet, script and icon are static files under /assets/
// and never reach this code.

import displayP3 from "./color/DisplayP3-v4.icc";
import interBold from "./fonts/Inter-Bold.subset.ttf";
import interMedium from "./fonts/Inter-Medium.subset.ttf";
import { zoneCoordsOf } from "./lib/coords.js";
import { resolveEvent } from "./lib/event.js";
import { buildIcs, summary } from "./lib/ics.js";
import { parsePath } from "./lib/parse-path.js";
import { iccpChunk, withChunk } from "./lib/png-p3.js";
import { canonicalZone, offsetAt } from "./lib/tz.js";
import { eventCard, homeCard, WIDTH } from "./render/card.js";
import { eventPage, homePage } from "./render/page.js";

// Part of every cached image's key. Raise it when the image's design changes.
const CARD_VERSION = "10";

// The Display P3 chunk every image carries, built once per isolate
let p3Chunk;
const WEEK = 604800;

const SECURITY = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const html = (body, status, cacheControl) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      ...SECURITY,
    },
  });

const redirect = (location, cacheControl = "no-store") =>
  new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": cacheControl },
  });

// "2026-11-25" → { year, month, day }
function readIsoDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

// What the image of this event depends on besides its link: nothing for a
// dated event, the day for an undated or repeating one, the minute for a live
// clock. Written into the image's URL, so a cached image is always the right
// one for its URL.
function cardStamp(event) {
  if (event.live) return `at=${Math.floor(event.start / 60000)}`;
  if (event.floating || event.recur) return `d=${event.dateIso}`;
  return "";
}

async function renderPng(svg, env) {
  const started = Date.now();
  const rendered = await env.RENDER.toPng(svg, {
    width: WIDTH,
    fonts: [new Uint8Array(interMedium), new Uint8Array(interBold)],
    defaultFontFamily: "Inter",
  });
  if (!rendered.ok) throw new Error(`og-svg answered ${rendered.status}: ${await rendered.text()}`);
  p3Chunk ??= await iccpChunk(displayP3);
  const png = withChunk(await rendered.arrayBuffer(), p3Chunk);
  return { png, ms: Date.now() - started };
}

// Answers …/card.png from the cache, or renders, caches and answers.
async function cardResponse(svg, keyUrl, env, ctx, cacheControl) {
  const cache = caches.default;
  const key = new Request(keyUrl);
  const hit = await cache.match(key);
  if (hit) {
    const response = new Response(hit.body, hit);
    response.headers.set("X-Card-Cache", "hit");
    return response;
  }
  const { png, ms } = await renderPng(svg, env);
  const headers = { "Content-Type": "image/png", "Cache-Control": cacheControl };
  ctx.waitUntil(cache.put(key, new Response(png, { headers })));
  return new Response(png, {
    headers: { ...headers, "X-Card-Cache": "miss", "Server-Timing": `render;dur=${ms}` },
  });
}

// Where the visitor is, for the home page's stripes: Cloudflare's reading of
// the request's address (the city, no permission asked), rounded to 0.1°, or
// failing that the principal place of the time zone it names.
// out: { lat, lon, zone } or undefined
function visitorPlace(request) {
  const cf = request.cf;
  const zone = cf?.timezone && canonicalZone(cf.timezone);
  if (!zone) return undefined;
  const lat = Number.parseFloat(cf.latitude);
  const lon = Number.parseFloat(cf.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
    return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, zone };
  const place = zoneCoordsOf(zone);
  return place ? { lat: place[0], lon: place[1], zone } : undefined;
}

// What this runtime's time zone data knows: for checking how fresh it is
function runtimeReport() {
  const july = Date.UTC(2026, 6, 1);
  return {
    zones: Intl.supportedValuesOf("timeZone").length,
    // America/Coyhaique was added in tzdata 2025b
    coyhaique: canonicalZone("America/Coyhaique"),
    // Paraguay moved to UTC−3 all year in tzdata 2024b: −180 if the data has it
    asuncionJulyOffset: offsetAt("America/Asuncion", july),
    // Egypt has had summer time again since 2023: 180
    cairoJulyOffset: offsetAt("Africa/Cairo", july),
    newYorkJulyOffset: offsetAt("America/New_York", july),
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    const origin = url.origin;

    // Links to the old image endpoint, /og?path=/10am,nyc,lon
    if (url.pathname === "/og") {
      const path = url.searchParams.get("path") ?? "";
      return redirect(
        `${path.startsWith("/") ? path : `/${path}`}/card.png`.replace(/^\/+card/, "/card"),
      );
    }
    if (url.pathname === "/favicon.ico")
      return redirect("/assets/favicon.svg", "public, max-age=86400");
    if (url.pathname === "/_/runtime")
      return Response.json(runtimeReport(), { headers: { "Cache-Control": "no-store" } });

    const model = parsePath(url.pathname);
    const imageKey = (stamp) => `${origin}${url.pathname}?${stamp}&v=${CARD_VERSION}`;

    if (model.kind === "home") {
      if (model.suffix === "png") {
        return cardResponse(homeCard(), imageKey("home"), env, ctx, `public, max-age=${WEEK}`);
      }
      if (model.suffix === "ics")
        return new Response("A calendar file needs a time and a time zone: /10am,nyc/event.ics", {
          status: 404,
        });
      if (model.suffix) return new Response("The home image is /card.png", { status: 404 });
      // The stripes are the visitor's own day, so the page is theirs alone:
      // their browser may keep it, a shared cache may not
      const where = visitorPlace(request);
      return html(
        homePage(origin, undefined, where),
        200,
        where ? "private, max-age=3600" : "public, max-age=3600",
      );
    }
    const where = visitorPlace(request);
    if (model.kind === "error")
      return html(homePage(origin, model.message, where), 404, "no-store");

    // An image URL says which day or minute it shows (see cardStamp)
    const options = {};
    const isCard = model.suffix === "png" || model.suffix === "svg";
    if (isCard) {
      options.date = readIsoDate(url.searchParams.get("d")) ?? undefined;
      const at = Number(url.searchParams.get("at"));
      if (at > 0) options.at = at * 60000;
    }

    const event = resolveEvent(model, Date.now(), options);
    if (event.error) {
      if (model.suffix) return new Response(event.error, { status: 404 });
      return html(homePage(origin, event.error, where), 404, "no-store");
    }
    const tail = model.suffix
      ? { ics: "/event.ics", png: "/card.png", svg: "/card.svg" }[model.suffix]
      : "";
    if (event.redirect) return redirect(event.redirect + tail + url.search);

    if (model.suffix === "ics") {
      if (event.live) return new Response("A live clock has no calendar file.", { status: 404 });
      const name = (
        summary(event)
          .replace(/[^\w -]+/g, "")
          .trim() || "event"
      ).slice(0, 60);
      return new Response(await buildIcs(event, origin + event.path, Date.now()), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}.ics"`,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const stamp = cardStamp(event);
    if (isCard) {
      const given = options.at ? "at" : options.date ? "d" : "";
      if (stamp && given !== stamp.split("=")[0]) {
        return redirect(`${event.path}${tail}?${stamp}`);
      }
      const svg = eventCard(event);
      if (model.suffix === "svg") {
        return new Response(svg, {
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
        });
      }
      return cardResponse(svg, imageKey(stamp || "pinned"), env, ctx, `public, max-age=${WEEK}`);
    }

    const image = `${origin}${event.path}/card.png${stamp ? `?${stamp}` : ""}`;
    // A dated event's page only changes with the clock in the browser. The
    // others depend on today's date, so they're revalidated.
    const cacheControl = stamp ? "no-cache" : "public, max-age=3600";
    return html(eventPage(event, origin, image), 200, cacheControl);
  },
};
