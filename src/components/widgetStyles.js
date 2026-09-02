/**
 * Shared widget design tokens.
 *
 * 「常用标签页」(ImportantTabs) 是所有小组件的视觉规范来源。
 * 所有 widget 必须复用这里的类串，保证：
 *   - 容器圆角 / 内边距 / 阴影一致
 *   - header 与内容区的间距一致
 *   - 主文字 / 次文字的字号与颜色一致
 *   - 图标尺寸与颜色一致
 *   - 交互按钮（刷新、收起、播放…）尺寸与颜色一致
 *   - 行高与行间距一致
 *   - 强调色统一为亮蓝
 */

/* ── 强调色：亮蓝 ── */
export const ACCENT = "#38BDF8"; // sky-400 — 所有 widget 的高亮 / 激活 / 进度条统一用它
export const ACCENT_RGB = "56, 189, 248";
export const accent = (alpha = 1) =>
  alpha >= 1 ? ACCENT : `rgba(${ACCENT_RGB}, ${alpha})`;

/* ── 容器 ── */
export const WIDGET_SHELL =
  "figma-glass-clean rounded-[26px] p-4 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative overflow-hidden";

/* ── Header ── */
export const WIDGET_HEADER =
  "w-full flex items-center justify-between z-10 relative shrink-0 mb-3";

/** 可拖拽的标题（含 drag handle 图标），接受 dragHandleProps */
export const HEADER_TITLE =
  "flex items-center gap-2 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none min-w-0";

export const HEADER_DRAG_ICON = "ri-draggable text-sm pointer-events-none shrink-0";

export const HEADER_LABEL = "pointer-events-none truncate text-white/70";

export const HEADER_SUB = "text-[10px] text-white/40 truncate font-gilroy-medium shrink-0";

/** 右上角的圆形图标按钮（刷新 / 播放 / 收起…） */
export const HEADER_ICON_BTN =
  "h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white/80 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export const HEADER_ICON_BTN_ICON = "text-sm";

/* ── 内容区 ── */
export const WIDGET_BODY =
  "w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col z-10 pr-0.5";

/* ── 行 ── */
export const ROW =
  "flex items-center justify-between gap-2.5 text-xs sm:text-sm py-1 cursor-pointer group";

export const ROW_GAP = "gap-0.5"; // 行间距

/* ── 文字 ── */
export const TEXT_PRIMARY = "font-gilroy-medium text-xs sm:text-sm text-white/90 truncate min-w-0";
export const TEXT_SECONDARY = "text-[10px] text-white/35 font-gilroy-medium shrink-0";
export const TEXT_MUTED = "text-[10px] text-white/40 font-gilroy-medium";

/* ── 图标 ── */
export const ICON = "text-white/80 text-base shrink-0";
export const ICON_SM = "text-white/70 text-sm shrink-0";

/* ── 空状态 ── */
export const EMPTY_STATE =
  "flex-1 flex flex-col items-center justify-center gap-1.5 text-center py-4";
export const EMPTY_ICON = "text-2xl text-white/30";
export const EMPTY_TITLE = "text-xs text-white/50";
export const EMPTY_HINT = "text-[10px] text-white/30";
