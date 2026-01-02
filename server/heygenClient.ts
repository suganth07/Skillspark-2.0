export type HeyGenGenerateResponse = {
  data?: { video_id?: string };
  video_id?: string;
};

export type HeyGenStatusResponse = {
  data?: {
    status?: "pending" | "waiting" | "processing" | "completed" | "failed";
    video_url?: string;
    thumbnail_url?: string;
  };
};

const BASE = "https://api.heygen.com";

function assertKey(key: string | null): asserts key is string {
  if (!key || !key.trim()) throw new Error("HeyGen API key not set");
}

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return {};
  }
}

// POST /v2/video/generate 
export async function heygenGenerateVideo(apiKey: string | null, payload: unknown) {
  assertKey(apiKey);

  const r = await fetch(`${BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey, // auth 
    },
    body: JSON.stringify(payload),
  });

  const json = (await safeJson(r)) as HeyGenGenerateResponse;
  if (!r.ok) throw new Error(JSON.stringify(json));
  return json;
}

// GET /v1/video_status.get?video_id=... 
export async function heygenVideoStatus(apiKey: string | null, videoId: string) {
  assertKey(apiKey);
  const url = new URL(`${BASE}/v1/video_status.get`);
  url.searchParams.set("video_id", videoId);

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey, // auth 
    },
  });

  const json = (await safeJson(r)) as HeyGenStatusResponse;
  if (!r.ok) throw new Error(JSON.stringify(json));
  return json;
}

export async function waitForHeygenVideoUrl(apiKey: string | null, videoId: string, opts?: {
  intervalMs?: number;
  timeoutMs?: number;
}) {
  const intervalMs = opts?.intervalMs ?? 2500;
  const timeoutMs = opts?.timeoutMs ?? 5 * 60 * 1000;

  const start = Date.now();
  while (true) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for HeyGen video");

    const s = await heygenVideoStatus(apiKey, videoId);
    const status = s?.data?.status;

    if (status === "completed") {
      const url = s?.data?.video_url;
      if (!url) throw new Error("Completed but no video_url returned");
      return url;
    }
    if (status === "failed") throw new Error("HeyGen video generation failed");

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
