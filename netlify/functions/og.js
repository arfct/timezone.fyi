/**
 * /og — the Open Graph card for a timezone comparison.
 *
 * Builds an SVG and hands it to the shared renderer rather than rasterizing
 * here. Replaces the node-canvas implementation, which could not run on
 * Netlify's current runtime.
 *
 * Renderer: https://github.com/arfct/og-svg
 */

import { getZoneInfo } from "../common.js";
import { zonesSvg } from "../zones-svg.js";

const RENDER_ORIGIN = "https://og-svg.arfct.workers.dev";

/**
 * @param req the incoming request
 * @param env on Cloudflare Workers, the environment. If it carries a RENDER
 *   service binding that is used instead of an HTTP call: a Worker fetching
 *   another Worker on the same workers.dev zone is refused with Cloudflare
 *   error 1042. On Netlify the second argument is the Netlify context, which has
 *   no RENDER key, so it falls through to a plain fetch.
 */
export default async (req, env) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return new Response("Missing path", { status: 400 });
  }

  const info = getZoneInfo(path);
  const svg = zonesSvg(info);

  const renderer = env?.RENDER ?? { fetch: (...args) => fetch(...args) };

  // POST rather than a query payload: these SVGs carry a gradient plus two text
  // runs per zone and would otherwise eat into the 16KB URL cap.
  const rendered = await renderer.fetch(`${RENDER_ORIGIN}/png`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svg, fontFamily: "Manrope" }),
  });

  if (!rendered.ok) {
    // Crawlers fall back to the title and description when the image is
    // missing, which beats serving a broken one. Pass the upstream reason
    // through rather than swallowing it — a bare "could not render" tells
    // whoever is debugging nothing.
    const detail = await rendered.text().catch(() => "");
    return new Response(
      `Could not render card: upstream ${rendered.status} ${detail.slice(0, 200)}`,
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new Response(rendered.body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=31536000",
    },
  });
};
