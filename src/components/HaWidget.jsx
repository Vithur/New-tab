import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  callService,
  detailOf,
  domainOf,
  fetchStates,
  filterSupported,
  isActive,
  metaOf,
  normalizeBase,
} from "../utils/ha.js";
import {
  WIDGET_SHELL,
  WIDGET_HEADER,
  HEADER_TITLE,
  HEADER_DRAG_ICON,
  HEADER_LABEL,
  HEADER_SUB,
  HEADER_ICON_BTN,
  WIDGET_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  ICON,
  accent,
} from "./widgetStyles";
import WidgetEmptyState from "./WidgetEmptyState";

const HaWidget = ({ dragHandleProps, haConfig }) => {
  const base = normalizeBase(haConfig?.baseUrl);
  const token = (haConfig?.token || "").trim();
  const selected = Array.isArray(haConfig?.entities) ? haConfig.entities : [];
  const intervalSec = Math.max(5, Number(haConfig?.intervalSec) || 30);

  const [states, setStates] = useState([]);
  const [status, setStatus] = useState(base && token ? "loading" : "empty");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(new Set());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!base || !token) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    try {
      const all = await fetchStates(base, token);
      if (!mountedRef.current) return;
      const list = filterSupported(all);
      const picked =
        selected.length > 0
          ? list.filter((s) => selected.includes(s.entity_id))
          : list;
      setStates(picked);
      setError("");
      setStatus("ok");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || String(err));
      setStatus("error");
    }
  }, [base, token, selected.join(",")]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status !== "ok") return;
    const id = setInterval(refresh, intervalSec * 1000);
    return () => clearInterval(id);
  }, [refresh, intervalSec, status]);

  const toggle = async (entity) => {
    const entityId = entity.entity_id;
    if (pending.has(entityId)) return;
    const next = !isActive(entity);
    setPending((s) => new Set(s).add(entityId));
    setStates((list) =>
      list.map((e) =>
        e.entity_id === entityId ? { ...e, state: next ? "on" : "off" } : e
      )
    );
    try {
      await callService(base, token, entityId, next);
    } catch (err) {
      setStates((list) =>
        list.map((e) => (e.entity_id === entityId ? entity : e))
      );
      setError(err?.message || String(err));
    } finally {
      setPending((s) => {
        const n = new Set(s);
        n.delete(entityId);
        return n;
      });
    }
  };

  return (
    <div className={WIDGET_SHELL}>
      <div className={WIDGET_HEADER}>
        <div className={HEADER_TITLE} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>家庭</span>
          {status === "ok" && (
            <span className={HEADER_SUB}>{states.length} 个设备</span>
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={!base || !token}
          className={HEADER_ICON_BTN}
          title="刷新设备状态"
        >
          <i className={`ri-refresh-line text-sm ${status === "loading" ? "animate-spin" : ""}`}></i>
        </button>
      </div>

      <div className={`${WIDGET_BODY} gap-1.5`}>
        {status === "empty" && (
          <WidgetEmptyState
            icon="ri-home-gear-line"
            title="尚未配置 Home Assistant"
            hint="在设置 → 家庭中填入地址与令牌"
          />
        )}

        {status === "error" && (
          <WidgetEmptyState
            icon="ri-error-warning-line"
            title="连接失败"
            hint={error || "请检查地址与令牌"}
          />
        )}

        {status === "loading" && states.length === 0 && (
          <WidgetEmptyState icon="ri-loader-4-line" title="正在读取设备状态…" />
        )}

        {status === "ok" && states.length === 0 && (
          <WidgetEmptyState
            icon="ri-home-smile-line"
            title="没有可控制的设备"
            hint="请在设置中勾选要显示的设备"
          />
        )}

        {/*
          设备行 —— 无描边（border 已移除），与「常用标签页」行结构一致：
          图标 + 主文字 + 状态 / 开关
        */}
        {states.map((entity) => {
          const meta = metaOf(entity.entity_id);
          const on = isActive(entity);
          const busy = pending.has(entity.entity_id);
          const detail = detailOf(entity);
          const isMomentary = ["script", "scene"].includes(domainOf(entity.entity_id));
          return (
            <button
              key={entity.entity_id}
              type="button"
              onClick={() => toggle(entity)}
              disabled={busy}
              className={`w-full flex items-center justify-between gap-2.5 text-xs sm:text-sm py-2 px-1.5 rounded-xl transition-colors cursor-pointer text-left group ${
                on ? "bg-white/[0.10] hover:bg-white/[0.14]" : "hover:bg-white/[0.07]"
              } ${busy ? "opacity-60 cursor-wait" : "active:scale-[0.98]"}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <i
                  className={`${on ? meta.iconOn : meta.icon} ${ICON} ${
                    on ? "" : "text-white/55"
                  }`}
                  style={on ? { color: accent(1) } : undefined}
                />
                <span className="flex flex-col min-w-0 flex-1">
                  <span className={TEXT_PRIMARY}>
                    {entity.attributes?.friendly_name || entity.entity_id}
                  </span>
                  <span className={TEXT_SECONDARY}>
                    {meta.label}
                    {detail ? ` · ${detail}` : ""}
                  </span>
                </span>
                {isMomentary && (
                  <i className="ri-play-line text-[10px] text-white/40 shrink-0"></i>
                )}
              </div>
              <span
                className={`h-4 w-7 rounded-full relative transition-all shrink-0 self-center ${
                  on ? "" : "bg-white/15"
                }`}
                style={on ? { backgroundColor: accent(0.85) } : undefined}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
                    on ? "left-[13px]" : "left-[1px]"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HaWidget;
