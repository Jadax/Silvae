// Vercel function adapter; see `server/functions/api/weather.ts`.
// Dynamic import keeps this CJS shim from `require()`-ing an ES module.
export default async function handler(req: Request): Promise<Response> {
  const impl = (await import("../server/functions/api/weather.js")).default;
  return impl(req);
}