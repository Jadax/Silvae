// Vercel function adapter; see `server/functions/api/share-invite.ts`.
// Named-method export uses Vercel's Web `fetch`-style API so the returned
// `Response` is actually sent (a default export is treated as `(req, res)`).
export function POST(request: Request): Promise<Response> {
  return import("../server/functions/api/share-invite.js").then((m) => m.default(request));
}