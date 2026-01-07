import type { NextApiRequest, NextApiResponse } from "next";

const UPSTREAM = "http://broadcast.shoutstream.co.uk:8126/status-json.xsl";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const upstreamRes = await fetch(UPSTREAM, {
      headers: { "User-Agent": "gluefactoryradio-live-status" },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).json({ error: `Upstream HTTP ${upstreamRes.status}` });
      return;
    }

    const text = await upstreamRes.text(); // Icecast returns JSON but as text
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(text);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "live-status proxy failed" });
  }
}

