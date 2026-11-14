// Vercel function adapter; see `server/functions/api/weather.ts` (compiled to dist/ by the Vercel build).
// api/package.json marks this folder as ES modules, so this is a real import
// that Vercel traces and bundles, not a require() of an ES module.
import handler from "../server/functions/dist/api/weather.js";

// Named-method export uses Vercel's Web fetch-style API so the returned Response is sent.
export function GET(request: Request): Promise<Response> {
  return handler(request);
}
