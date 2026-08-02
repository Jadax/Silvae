// Vercel discovers functions from the repository-root `api` directory.
// Keep the implementation with the server package so it remains testable and
// reusable outside the Vercel adapter.
export { default } from "../server/functions/api/identify.js";
