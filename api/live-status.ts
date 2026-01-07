export const config = { runtime: "nodejs" };

const UPSTREAM = "http://broadcast.shoutstream.co.uk:8126/status-json.xsl";

export default async function handler(req: any, res: any) {
  try {
    const r = await fetch(UPSTREAM, {
      headers: { "User-Agent": "gfr-live-status" },
      cache: "no-store",
    });

    const text = await r.text();

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Vercel-CDN-Cache-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    res.status(r.ok ? 200 : r.status).send(text);
  } catch (e: any) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.status(500).json({ error: e?.message ?? "live-status proxy failed" });
  }
}

