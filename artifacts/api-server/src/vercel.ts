/**
 * Vercel serverless entry point — every /api/* request on the live site runs
 * through here (routing is set up in scripts/vercel-build.mjs).
 *
 * The routing rule forwards the sub-path in an `__ep_path` query parameter
 * (`/api/shop/products` → `/api?__ep_path=shop/products`) so this works no
 * matter whether Vercel hands the function the original URL or the rewritten
 * one. We restore the real path before passing the request to Express.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";

export const PATH_PARAM = "__ep_path";

/** Turns a routed URL back into the original `/api/...` URL. Exported for tests. */
export function restoreApiUrl(rawUrl: string): string {
  const url = new URL(rawUrl, "http://internal");
  if (!url.searchParams.has(PATH_PARAM)) return rawUrl;

  const subPath = url.searchParams.get(PATH_PARAM) ?? "";
  url.searchParams.delete(PATH_PARAM);
  const encoded = subPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/${encoded}${url.search}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = restoreApiUrl(req.url ?? "/api");
  // An Express app is itself a (req, res) request handler.
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
