import React, { useEffect, useRef, useState } from "react";
import { fitPopoverInContainer } from "./iconData.js";

/* ─── Time Dropdown Popover ───
   Picker for a "HH:MM" time string. Mirrors IconDropdownPopover's API
   (triggerRef / current / onSelect / onClose / uiTheme) so it can be dropped
   into the same popover slots in SettingsPage. */
export const TimeDropdownPopover = ({ current, onSelect, onClose, uiTheme = "default", triggerRef }) => {
  const popoverRef = useRef(null);
  const [openUpwards, setOpenUpwards] = useState(false);

  const parse = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
    if (m) {
      return {
        h: Math.min(23, Math.max(0, parseInt(m[1], 10) || 0)),
        m: Math.min(59, Math.max(0, parseInt(m[2], 10) || 0)),
      };
    }
    return { h: 9, m: 0 };
  };

  const init = parse(current);
  const [hour, setHour] = useState(init.h);
  const [minute, setMinute] = useState(init.m);

  useEffect(() => {
    if (popoverRef.current) {
      fitPopoverInContainer(popoverRef.current, triggerRef?.current, setOpenUpwards);
    }
  }, [triggerRef]);

  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      const trigger = triggerRef?.current;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !(trigger && trigger.contains(e.target))
      ) {
        onClose();
      }
    };
    const timerId = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDownOutside, true);
    }, 50);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
    };
  }, [onClose, triggerRef]);

  const pad = (n) => String(n).padStart(2, "0");
  const step = (val, delta, max) => (val + delta < 0 ? max : val + delta > max ? 0 : val + delta);

  const Column = ({ label, value, onChange, max }) => (
    <div className="flex-1 flex flex-col items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider opacity-70 font-gilroy-bold">{label}</span>
      <button
        type="button"
        onClick={() => onChange(step(value, 1, max))}
        className="h-6 w-10 rounded-lg bg-white/10 hover:bg-white/25 text-white/80 flex items-center justify-center cursor-pointer transition-all active:scale-95"
      >
        <i className="ri-arrow-up-s-line text-base" />
      </button>
      <span className="text-3xl font-gilroy-bold tabular-nums w-14 text-center leading-none">{pad(value)}</span>
      <button
        type="button"
        onClick={() => onChange(step(value, -1, max))}
        className="h-6 w-10 rounded-lg bg-white/10 hover:bg-white/25 text-white/80 flex items-center justify-center cursor-pointer transition-all active:scale-95"
      >
        <i className="ri-arrow-down-s-line text-base" />
      </button>
    </div>
  );

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: "color-mix(in srgb, var(--theme-4, #0F172A) 96%, #000000)",
        borderColor: "color-mix(in srgb, var(--theme-1, var(--theme)) 45%, transparent)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.9), 0 0 20px color-mix(in srgb, var(--theme-1, var(--theme)) 25%, transparent)",
      }}
      className={`absolute left-0 ${
        openUpwards ? "bottom-full mb-2" : "top-full mt-2"
      } z-[99999] w-56 rounded-2xl p-3 flex flex-col gap-3 shadow-2xl border backdrop-blur-2xl text-white`}
    >
      <div className="flex items-center justify-between shrink-0">
        <span
          style={{ color: "var(--theme-2, var(--theme-1, var(--theme)))" }}
          className="text-[10px] uppercase tracking-wider font-gilroy-bold opacity-90"
        >
          选择时间
        </span>
        <button
          type="button"
          onClick={onClose}
          title="关闭"
          aria-label="关闭时间选择器"
          className="h-6 w-6 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 bg-white/10 text-white/70 hover:text-white border-white/15 hover:bg-white/25"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Column label="时" value={hour} onChange={setHour} max={23} />
        <span className="text-3xl font-gilroy-bold opacity-50 pb-5 leading-none">:</span>
        <Column label="分" value={minute} onChange={setMinute} max={59} />
      </div>

      <button
        type="button"
        onClick={() => {
          onSelect(`${pad(hour)}:${pad(minute)}`);
          onClose();
        }}
        style={{ backgroundColor: "var(--theme)", borderColor: "var(--theme)" }}
        className="h-8 rounded-xl border text-white font-gilroy-bold text-xs cursor-pointer hover:brightness-110 active:scale-95 shadow-sm"
      >
        确定
      </button>
    </div>
  );
};
