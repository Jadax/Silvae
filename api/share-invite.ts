// Vercel function adapter; see `server/functions/api/share-invite.ts`.
// Dynamic import keeps this CJS shim from `require()`-ing an ES module.
export default async function handler(req: Request): Promise<Response> {
  const impl = (await import("../server/functions/api/share-invite.js")).default;
  return impl(req);
}