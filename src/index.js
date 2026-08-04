/**
 * timezone.fyi on Cloudflare Workers, running alongside the Netlify deployment.
 *
 * Both deployments share one code path. The Netlify functions are already plain
 * `Request -> Response` handlers with no Netlify-specific APIs, so this Worker
 * delegates to them unchanged rather than reimplementing anything — which keeps
 * the two deployments comparable and means Netlify is untouched by this port.
 *
 * Routing mirrors Netlify's precedence: assets in static/ are served first
 * (including / itself), and everything else lands here.
 */

import ogHandler from "../netlify/functions/og.js";
import indexHandler from "../netlify/functions/index.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // netlify.toml routes /og with force = true, so it wins over assets there
      // too. og.js reads the `path` query parameter.
      //
      // env carries the RENDER service binding: reaching og-svg over HTTP from
      // here is refused with Cloudflare error 1042, because both Workers sit on
      // the same workers.dev zone.
      if (url.pathname === "/og") return await ogHandler(request, env);
      return await indexHandler(request);
    } catch (err) {
      return new Response(`timezone.fyi error: ${err.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      });
    }
  },
};
