// Vercel function adapter; see `server/functions/api/identify.ts`.
// Dynamic import keeps this CJS shim from `require()`-ing an ES module.
export default async function handler(req: Request): Promise<Response> {
  const impl = (await import("../server/functions/api/identify.js")).default;
  return impl(req);
}