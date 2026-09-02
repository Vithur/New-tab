import React, { useState, useEffect, useCallback, useMemo } from "react";
import { fetchFeedText } from "../utils/rss";
import {
  WIDGET_SHELL,
  WIDGET_HEADER,
  HEADER_TITLE,
  HEADER_DRAG_ICON,
  HEADER_LABEL,
  HEADER_SUB,
  HEADER_ICON_BTN,
  WIDGET_BODY,
  ROW_GAP,
  accent,
} from "./widgetStyles";
import WidgetEmptyState from "./WidgetEmptyState";

const CACHE_KEY = "settings_rss_cache_v1";
const PROXY_USAGE_KEY = "settings_rss_proxy_usage_v1";
const READ_KEY = "settings_rss_read_v1";
const READ_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const loadReadSet = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) || "null");
    if (!raw || typeof raw !== "object") return new Set();
    const cutoff = Date.now() - READ_TTL_MS;
    return new Set(
      Object.entries(raw)
        .filter(([, ts]) => typeof ts === "number" && ts > cutoff)
        .map(([link]) => link)
    );
  } catch {
    return new Set();
  }
};

const saveReadSet = (set) => {
  try {
    const out = {};
    set.forEach((link) => { out[link] = Date.now(); });
    localStorage.setItem(READ_KEY, JSON.stringify(out));
  } catch {}
};

const relTime = (d) => {
  if (!d) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function parseFeed(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) return [];
  const isAtom = Boolean(doc.querySelector("feed"));
  if (isAtom) {
    return [...doc.querySelectorAll("entry")].map((e) => {
      const linkEl =
        [...e.querySelectorAll("link")].find((l) => l.getAttribute("rel") !== "self") ||
        e.querySelector("link");
      const dateStr = e.querySelector("updated")?.textContent || e.querySelector("published")?.textContent;
      return {
        title: e.querySelector("title")?.textContent?.trim() || "（无标题）",
        link: linkEl?.getAttribute("href") || "",
        date: dateStr ? new Date(dateStr) : null,
      };
    });
  }
  return [...doc.querySelectorAll("item")].map((e) => ({
    title: e.querySelector("title")?.textContent?.trim() || "（无标题）",
    link: e.querySelector("link")?.textContent?.trim() || "",
    date: e.querySelector("pubDate")?.textContent ? new Date(e.querySelector("pubDate").textContent) : null,
  }));
}

const RssWidget = ({ dragHandleProps, rssConfig }) => {
  const feeds = Array.isArray(rssConfig?.feeds) ? rssConfig.feeds.filter((f) => f.enabled && f.url) : [];
  const intervalMin = Number(rssConfig?.intervalMin) || 30;
  const maxItems = Number(rssConfig?.maxItems) || 8;

  const [items, setItems] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.items)) return cached.items;
    } catch {}
    return null;
  });
  const [status, setStatus] = useState(feeds.length ? "loading" : "empty");
  const [proxyUsed, setProxyUsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROXY_USAGE_KEY) || "null") || {};
    } catch { return {}; }
  });
  const [readSet, setReadSet] = useState(() => loadReadSet());

  const markRead = (link) => {
    if (!link) return;
    setReadSet((prev) => {
      if (prev.has(link)) return prev;
      const next = new Set(prev);
      next.add(link);
      saveReadSet(next);
      return next;
    });
  };

  const refresh = useCallback(async () => {
    if (!feeds.length) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    const newProxyMap = { ...proxyUsed };
    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        const { text, proxy } = await fetchFeedText(f.url.trim(), (p) => {
          newProxyMap[f.id] = p;
          setProxyUsed({ ...newProxyMap });
        });
        newProxyMap[f.id] = proxy;
        const parsed = parseFeed(text);
        return parsed.slice(0, Math.max(3, maxItems)).map((it) => ({ ...it, source: f.name || hostOf(f.url) }));
      })
    );
    localStorage.setItem(PROXY_USAGE_KEY, JSON.stringify(newProxyMap));
    const merged = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, maxItems);
    if (merged.length || results.every((r) => r.status === "fulfilled")) {
      setItems(merged);
      setStatus("ok");
      localStorage.setItem(CACHE_KEY, JSON.stringify({ items: merged, at: Date.now() }));
    } else {
      setStatus(items ? "ok" : "error");
    }
  }, [feeds, maxItems, items, proxyUsed]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, Math.max(5, intervalMin) * 60000);
    return () => clearInterval(id);
  }, [intervalMin, maxItems, JSON.stringify(feeds)]);

  const feedIndex = useMemo(() => {
    const map = new Map();
    feeds.forEach((f, i) => map.set(f.name || hostOf(f.url), i));
    return map;
  }, [feeds]);

  return (
    <div className={WIDGET_SHELL}>
      <div className={WIDGET_HEADER}>
        <div className={HEADER_TITLE} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>新消息</span>
          {feeds.length > 0 && (
            <span className={HEADER_SUB}>{feeds.length} 个源</span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={!feeds.length}
          className={HEADER_ICON_BTN}
          title="刷新订阅"
        >
          <i className={`ri-refresh-line text-sm ${status === "loading" ? "animate-spin" : ""}`}></i>
        </button>
      </div>

      <div className={`${WIDGET_BODY} ${ROW_GAP}`}>
        {status === "empty" && (
          <WidgetEmptyState
            icon="ri-rss-line"
            title="尚未添加 RSS 源"
            hint="在设置 → 新消息中添加订阅地址"
          />
        )}

        {status === "error" && (
          <WidgetEmptyState
            icon="ri-error-warning-line"
            title="订阅获取失败"
            hint="所有通道（直连/corsproxy/allorigins）均失败"
          />
        )}

        {status === "loading" && !items && (
          <WidgetEmptyState icon="ri-loader-4-line" title="正在获取订阅内容…" />
        )}

        {status === "ok" && items && items.length === 0 && (
          <WidgetEmptyState icon="ri-inbox-line" title="暂无内容" />
        )}

        {status === "ok" &&
          (items || []).map((it, i) => {
            const isRead = it.link && readSet.has(it.link);
            return (
              <a
                key={i}
                href={it.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markRead(it.link)}
                className={`flex flex-col gap-0.5 py-1 px-1.5 rounded-xl active:scale-[0.98] transition-colors group ${
                  isRead ? "hover:bg-white/[0.04]" : "hover:bg-white/10"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[10px] font-gilroy-medium min-w-0 ${
                    isRead ? "text-white/30" : "text-white/40"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 transition-opacity ${
                      isRead ? "opacity-0" : "opacity-100"
                    }`}
                    style={{ backgroundColor: accent(0.85) }}
                  />
                  <span className="truncate min-w-0">{it.source}</span>
                  <span className={`shrink-0 ${isRead ? "text-white/15" : "text-white/25"}`}>·</span>
                  <span className="shrink-0">{relTime(it.date)}</span>
                </div>
                <h3
                  className={`text-xs sm:text-sm leading-snug break-words line-clamp-2 transition-colors ${
                    isRead ? "text-white/45" : "text-white/90"
                  }`}
                >
                  {it.title}
                </h3>
              </a>
            );
          })}
      </div>
    </div>
  );
};

export default RssWidget;
