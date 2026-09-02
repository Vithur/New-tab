import React, { useState, useEffect, useCallback, useMemo } from "react";
import { fetchCalendar, upcomingEvents, calendarOrigin } from "../utils/ics";
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
  TEXT_PRIMARY,
  TEXT_MUTED,
  ICON,
  accent,
} from "./widgetStyles";
import WidgetEmptyState from "./WidgetEmptyState";

const CACHE_KEY = "settings_calendar_cache_v1";

const fmtTime = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const fmtMonthDay = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;

const weekdayShort = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const CalendarWidget = ({ dragHandleProps, calendarSub }) => {
  const feeds = useMemo(
    () => (Array.isArray(calendarSub?.feeds) ? calendarSub.feeds.filter((f) => f && typeof f.url === "string" && f.url.trim()) : []),
    [calendarSub?.feeds]
  );
  const activeFeeds = useMemo(() => feeds.filter((f) => f.enabled !== false), [feeds]);
  const intervalMin = Number(calendarSub?.intervalMin) || 30;
  const maxEvents = Number(calendarSub?.maxEvents) || 8;
  const enabledKey = activeFeeds.map((f) => `${f.id}:${f.url}`).join("|");

  const [events, setEvents] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.key === enabledKey && Array.isArray(cached.events)) {
        return cached.events.map((ev) => ({
          ...ev,
          start: { ...ev.start, date: new Date(ev.start.date) },
          end: ev.end ? { ...ev.end, date: new Date(ev.end.date) } : undefined,
        }));
      }
    } catch {}
    return null;
  });
  const [status, setStatus] = useState(activeFeeds.length ? "loading" : "empty");

  const refresh = useCallback(async () => {
    if (activeFeeds.length === 0) {
      setStatus("empty");
      setEvents(null);
      return;
    }
    setStatus("loading");
    try {
      const results = await Promise.allSettled(
        activeFeeds.map((f) =>
          fetchCalendar(f.url).then((parsed) => ({
            events: upcomingEvents(parsed, maxEvents * 2),
            feed: f,
          }))
        )
      );
      const merged = [];
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value.events)) merged.push(...r.value.events);
      }
      const sorted = merged
        .sort((a, b) => (a.start?.date || 0) - (b.start?.date || 0))
        .slice(0, maxEvents);
      setEvents(sorted);
      setStatus("ok");
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ key: enabledKey, events: sorted, at: Date.now() })
      );
    } catch (err) {
      console.warn("日历订阅获取失败：", err);
      setStatus(events ? "ok" : "error");
    }
  }, [activeFeeds, maxEvents, enabledKey]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, Math.max(5, intervalMin) * 60000);
    return () => clearInterval(id);
  }, [refresh, intervalMin]);

  const sourceSummary = activeFeeds.length
    ? (activeFeeds.length === 1
        ? (activeFeeds[0].name || calendarOrigin(activeFeeds[0].url)?.replace(/^https?:\/\//, "").replace(/\/$/, ""))
        : `${activeFeeds.length} 个订阅源`)
    : "";

  /* 平铺：每天一个「日期小节标题 + 事件行」，不再有嵌套的黑框卡片 */
  const grouped = useMemo(() => {
    if (!events) return [];
    const map = new Map();
    for (const ev of events) {
      const d = ev.start?.date;
      if (!d) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(k)) {
        map.set(k, { date: d, items: [] });
      }
      map.get(k).items.push(ev);
    }
    return [...map.values()];
  }, [events]);

  return (
    <div className={WIDGET_SHELL}>
      <div className={WIDGET_HEADER}>
        <div className={HEADER_TITLE} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>日历</span>
          {sourceSummary && <span className={HEADER_SUB}>{sourceSummary}</span>}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={!activeFeeds.length}
          className={HEADER_ICON_BTN}
          title="刷新订阅"
        >
          <i className={`ri-refresh-line text-sm ${status === "loading" ? "animate-spin" : ""}`}></i>
        </button>
      </div>

      <div className={`${WIDGET_BODY} ${ROW_GAP}`}>
        {status === "empty" && (
          <WidgetEmptyState
            icon="ri-calendar-line"
            title="尚未添加日历订阅"
            hint="在设置 → 日历订阅中添加 ICS 链接"
          />
        )}

        {status === "error" && (
          <WidgetEmptyState
            icon="ri-error-warning-line"
            title="订阅获取失败"
            hint="请检查链接或网络后重试"
          />
        )}

        {status === "loading" && !events && (
          <WidgetEmptyState icon="ri-loader-4-line" title="正在获取日程…" />
        )}

        {status === "ok" && grouped.length === 0 && (
          <WidgetEmptyState icon="ri-calendar-check-line" title="近期没有日程" />
        )}

        {grouped.map((group) => (
          <div key={`${group.date.getFullYear()}-${group.date.getMonth()}-${group.date.getDate()}`}>
            {/* 日期小节 — 扁平的分隔行，不是卡片 */}
            <div className="flex items-center gap-2 pt-2 pb-1 first:pt-0">
              <i className="ri-calendar-2-line text-xs text-white/40 shrink-0" />
              <span className="text-[10.5px] font-gilroy-bold text-white/50 tracking-wide">
                {fmtMonthDay(group.date)}
              </span>
              <span className="text-[10px] text-white/30 font-gilroy-medium">
                {weekdayShort[group.date.getDay()]}
              </span>
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-white/25 font-gilroy-medium shrink-0">
                {group.items.length} 项
              </span>
            </div>

            {/* 事件行 — 与「常用标签页」行完全一致的结构 */}
            {group.items.map((ev, i) => {
              const start = ev.start?.date;
              const end = ev.end?.date;
              const timeText = ev.start?.allDay
                ? "全天"
                : `${fmtTime(start)}${end ? ` – ${fmtTime(end)}` : ""}`;
              return (
                <div
                  key={ev.uid || i}
                  className="flex items-center justify-between gap-2.5 text-xs sm:text-sm py-1 px-1.5 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* 强调色竖条取代黑框 */}
                    <span
                      className="w-1 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: accent(0.9) }}
                    />
                    <span className={TEXT_PRIMARY}>{ev.summary || "（无标题）"}</span>
                  </div>
                  <span className="text-[10px] text-white/35 font-mono shrink-0 tabular-nums">
                    {timeText}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWidget;
