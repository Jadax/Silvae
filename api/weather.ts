// Vercel function adapter; see `server/functions/api/weather.ts` (compiled to dist/ by the Vercel build).
// Named-method export uses Vercel's Web `fetch`-style API so the returned
// `Response` is actually sent (a default export is treated as `(req, res)`).
export function GET(request: Request): Promise<Response> {
  return import("../server/functions/dist/api/weather.js").then((m) => m.default(request));
}