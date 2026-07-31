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

export default async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return new Response("Missing path", { status: 400 });
  }

  const info = getZoneInfo(path);
  const svg = zonesSvg(info);

  // POST rather than a query payload: these SVGs carry a gradient plus two text
  // runs per zone and would otherwise eat into the 16KB URL cap.
  const rendered = await fetch(`${RENDER_ORIGIN}/png`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ svg, fontFamily: "Manrope" }),
  });

  if (!rendered.ok) {
    // Crawlers fall back to the title and description when the image is
    // missing, which beats serving a broken one.
    return new Response("Could not render card", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(rendered.body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=31536000",
    },
  });
};
