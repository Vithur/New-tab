// RSS feed fetch with CORS fallback strategy.
// Chrome extension pages generally have CORS for arbitrary https,
// but some feeds (e.g. aihot.virxact.com) don't return Access-Control-Allow-Origin.
// Strategy: try direct → try corsproxy.io → try allorigins.
// Result is whichever succeeds first; failures get aggregated.
const PROXIES = [
  { id: "direct", prefix: "" },
  { id: "corsproxy", prefix: "https://corsproxy.io/?", encode: true },
  { id: "allorigins", prefix: "https://api.allorigins.win/raw?url=", encode: true },
];

async function fetchViaProxy(url, proxyId) {
  const proxy = PROXIES.find((p) => p.id === proxyId) || PROXIES[0];
  const target = proxy.encode ? proxy.prefix + encodeURIComponent(url) : proxy.prefix + url;
  const res = await fetch(target, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text || !text.trim().startsWith("<")) {
    throw new Error("响应不是 XML/HTML 文本");
  }
  return text;
}

export async function fetchFeedText(url, onProxyChange) {
  const errors = [];
  for (const proxy of PROXIES) {
    try {
      const text = await fetchViaProxy(url, proxy.id);
      if (proxy.id !== "direct") {
        onProxyChange?.(proxy.id);
      }
      return { text, proxy: proxy.id };
    } catch (err) {
      errors.push(`${proxy.id}: ${err?.message || err}`);
    }
  }
  throw new Error(`全部通道失败 — ${errors.join(" / ")}`);
}

export function listProxies() {
  return PROXIES.map((p) => p.id);
}
