import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MUSIC_SOURCES } from "../App";
import { UI_THEMES } from "../themes/index.js";
import {
  exportAllStorageData,
  importAllStorageData,
  clearAllStorageData,
} from "../utils/storage.js";
import {
  fitPopoverInContainer,
  ICON_CATEGORIES,
  ICON_GRID_ITEMS,
} from "./iconData.js";
import { IconDropdownPopover } from "./IconPicker.jsx";
import { TimeDropdownPopover } from "./TimePicker.jsx";
import { CN_FONTS, cnFontStack } from "../utils/fonts";
import {
  CAROUSEL_DIR_KEY,
  deleteHandle,
  fsAccessSupported,
  getHandle,
  pickDirectory,
  queryPermission,
  saveHandle,
  SONG_MUSIC_DIR_PREFIX,
  SONG_VIDEO_DIR_KEY,
  emitVideoReload,
} from "../utils/fsAccess.js";
import {
  DOMAIN_META,
  domainOf,
  fetchStates,
  filterSupported,
  testConnection,
} from "../utils/ha.js";

/* ─── Ringtone helpers ─── */
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* silent fail */
  }
};

const playCustomRingtone = (dataUrl) => {
  try {
    const audio = new Audio(dataUrl);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {
    /* silent fail */
  }
};

const previewRingtone = (ringtone) => {
  if (!ringtone || ringtone === "beep") {
    playBeep();
  } else {
    playCustomRingtone(ringtone);
  }
};

/* ─── Constants ─── */
const THEME_PRESETS = [
  { id: "slate", colors: ["#CBD5E1", "#64748B", "#334155", "#0F172A"] },
  { id: "ocean", colors: ["#7DD3FC", "#0EA5E9", "#0369A1", "#0C4A6E"] },
  { id: "emerald", colors: ["#86EFAC", "#22C55E", "#15803D", "#14532D"] },
  { id: "amber", colors: ["#FDE047", "#EAB308", "#A16207", "#713F12"] },
  { id: "orange", colors: ["#FDBA74", "#F97316", "#C2410C", "#7C2D12"] },
  { id: "rose", colors: ["#FCA5A5", "#EF4444", "#B91C1C", "#7F1D1D"] },
  { id: "purple", colors: ["#D8B4FE", "#A855F7", "#6B21A8", "#581C87"] },
  { id: "dark", colors: ["#9CA3AF", "#4B5563", "#1F2937", "#111827"] },
];



const MAX_SHORTCUTS = 7;

const NAV_TABS = [
  { id: "appearance", label: "外观与主题", icon: "ri-palette-line" },
  { id: "songPlayer", label: "播放器", icon: "ri-music-2-line" },
  { id: "taskbar", label: "Dock栏", icon: "ri-external-link-line" },
  { id: "tabs", label: "收藏夹", icon: "ri-bookmark-3-line" },
  { id: "timebox", label: "日历", icon: "ri-calendar-line" },
  { id: "rss", label: "新消息", icon: "ri-rss-line" },
  { id: "carousel", label: "照片", icon: "ri-image-line" },
  { id: "ha", label: "家庭", icon: "ri-home-gear-line" },
  { id: "widgets", label: "小组件显示", icon: "ri-layout-grid-line" },
  { id: "backup", label: "导出与恢复数据", icon: "ri-save-3-line" },
];

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

/* ─── Figma Glass Matching UI Primitives ─── */

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition-all duration-300 flex items-center px-0.5 shrink-0 cursor-pointer border border-white/15 ${
      checked ? "bg-[color:var(--accent)] shadow-md" : "bg-black/50 border-white/10"
    }`}
    aria-pressed={checked}
  >
    <span
      className={`h-5 w-5 rounded-full transition-transform duration-300 shadow-md ${
        checked ? "translate-x-5 bg-white" : "translate-x-0 bg-white/70"
      }`}
    />
  </button>
);

const InputField = ({ value, onChange, placeholder, className = "", type = "text" }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full h-10 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-3.5 text-xs text-white placeholder:text-white/30 outline-none transition-all font-gilroy-medium ${className}`}
  />
);

const Pill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-gilroy-medium transition-all active:scale-95 cursor-pointer border ${
      active
        ? "bg-[color:var(--accent)] text-[color:var(--theme-text,#fff)] font-gilroy-bold border-[color:var(--accent)] shadow-md scale-105"
        : "bg-[color:var(--accent)]/20 hover:bg-[color:var(--accent)]/35 text-[color:var(--theme-text,#fff)] border-white/15"
    }`}
  >
    {children}
  </button>
);

/* ── 选项按钮（分段选择）：选中=亮蓝+黑字，未选中=灰背景+白/深字 ── */
const OptionButton = ({ active, onClick, children, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
      active
        ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)] shadow-md scale-105"
        : "bg-black/30 border-white/10 text-white/70 hover:text-white hover:border-white/30"
    } ${className}`}
  >
    {children}
  </button>
);

const CardContainer = ({ title, description, children, action, overflowVisible = false }) => (
  <div
    className="card-glass-bg bg-black/30 border border-white/10 rounded-[24px] p-6 flex flex-col gap-5 relative text-white font-gilroy-medium shadow-xl backdrop-blur-sm"
    style={overflowVisible ? { overflow: "visible" } : undefined}
  >
    <div className="flex items-start justify-between gap-4 z-10 relative">
      <div>
        <h3 className="text-white text-base font-gilroy-bold">{title}</h3>
        {description && <p className="text-white/50 text-xs mt-1 font-gilroy-medium">{description}</p>}
      </div>
      {action}
    </div>
    <div className="z-10 relative">{children}</div>
  </div>
);

/* ─── Ringtone Selector Component ─── */
const RingtoneRow = ({ label, value, onChange }) => {
  const fileRef = useRef(null);
  const hasCustom = value && value !== "beep";

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-white/80 text-xs font-gilroy-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Pill active={!value || value === "beep"} onClick={() => onChange("beep")}>
          默认提示音
        </Pill>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
        <Pill active={hasCustom} onClick={() => fileRef.current?.click()}>
          {hasCustom ? "Custom Tone ✓" : "Upload Tone"}
        </Pill>
        <button
          type="button"
          onClick={() => previewRingtone(value)}
          className="h-8 w-8 rounded-full bg-[color:var(--accent)]/25 hover:bg-[color:var(--accent)]/45 border border-white/20 flex items-center justify-center text-[color:var(--theme-text,#fff)]/90 hover:text-[color:var(--theme-text,#fff)] transition-all active:scale-95 cursor-pointer shrink-0"
          title="试听"
        >
          <i className="ri-volume-up-line text-sm relative z-10" />
        </button>
      </div>
    </div>
  );
};

/* ─── Unified Icon Picker Modal ─── */
const IconPickerModal = ({ current, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredItems = useMemo(() => {
    return ICON_GRID_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.class.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/65 backdrop-blur-xl animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#121216]/95 backdrop-blur-2xl border border-[color:var(--accent)]/40 rounded-[26px] p-6 w-full max-w-lg max-h-[82vh] flex flex-col gap-4 text-white font-gilroy-medium shadow-2xl relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <i className="ri-palette-line text-lg text-[color:var(--accent)]" />
            <h4 className="text-sm font-gilroy-bold text-white">选择图标</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white cursor-pointer transition-all p-1"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        {/* Search Input */}
        <InputField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons (e.g. bed, exercise, coffee, code, sleep)..."
        />

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 shrink-0">
          {ICON_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-gilroy-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeCategory === cat.id
                  ? "bg-[color:var(--accent)] border-white/40 text-[color:var(--theme-text,#fff)] font-gilroy-bold shadow-md"
                  : "bg-black/40 border-white/15 text-white/70 hover:text-white hover:bg-white/15"
              }`}
            >
              <i className={`${cat.icon} text-xs`} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Icons Grid */}
        <div className="grid grid-cols-7 gap-2 overflow-y-auto scrollbar-hide max-h-64 pr-1 z-10 relative py-1">
          {filteredItems.map((item) => (
            <button
              key={item.class}
              type="button"
              onClick={() => {
                onSelect(item.class);
                onClose();
              }}
              className={`h-11 w-11 rounded-2xl flex items-center justify-center text-xl transition-all cursor-pointer border ${
                item.class === current
                  ? "bg-[color:var(--accent)] border-white/50 text-[color:var(--theme-text,#fff)] font-bold shadow-md scale-105"
                  : "bg-black/40 border-white/15 text-[color:var(--theme-text,#fff)]/80 hover:text-[color:var(--theme-text,#fff)] hover:bg-[color:var(--accent)]/30 hover:border-white/30 hover:scale-105"
              }`}
              title={`${item.class} (${item.keywords})`}
            >
              <i className={`${item.class} relative z-10`} />
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-7 py-8 text-center text-xs opacity-50 font-gilroy-medium">
              No matching icons found for "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FONT_SIZE_TICKS = [
  { value: 14, label: "小", sub: "14px (87.5%)" },
  { value: 15, label: "紧凑", sub: "15px (93.8%)" },
  { value: 16, label: "默认", sub: "16px (100%)" },
  { value: 18, label: "大", sub: "18px (112.5%)" },
  { value: 20, label: "特大", sub: "20px (125%)" },
];

const FONT_CATEGORIES = ["全部", "黑体", "宋体", "楷体"];

/* ─── TAB 1: Appearance ─── */
const AppearanceTab = ({
  wallpaper,
  onWallpaperPick,
  onWallpaperReset,
  themeColor,
  themeColorsMap,
  onThemeChange,
  themeTextColorIndex = 1,
  onThemeTextColorChange,
  uiTheme = "default",
  onUiThemeChange,
  baseFont = "Gilroy",
  onBaseFontChange,
  baseFontSize = 16,
  onBaseFontSizeChange,
  heroLayout = "left",
  onHeroLayoutChange,
}) => {
  const wallpaperInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [fontCategory, setFontCategory] = useState("全部");

  const filteredFonts = useMemo(() => {
    let list = CN_FONTS;
    if (fontCategory !== "全部") {
      list = list.filter((f) => f.cat === fontCategory);
    }
    const query = fontSearch.toLowerCase().trim();
    if (!query) return list;

    return list.filter(
      (f) => f.name.toLowerCase().includes(query) || f.desc.toLowerCase().includes(query)
    );
  }, [fontSearch, fontCategory]);

  const showCustomAdd = useMemo(() => {
    const query = fontSearch.trim();
    if (!query) return false;
    return !CN_FONTS.some((f) => f.name.toLowerCase() === query.toLowerCase());
  }, [fontSearch]);

  const processDroppedUrl = async (rawUrl) => {
    if (!rawUrl) return;
    const cleanUrl = rawUrl.trim();
    setIsProcessing(true);

    try {
      if (cleanUrl.startsWith("data:video/")) {
        onWallpaperPick({ type: "video", dataUrl: cleanUrl, name: "Dropped Video" });
        return;
      }
      if (cleanUrl.startsWith("data:image/")) {
        onWallpaperPick({ type: "image", dataUrl: cleanUrl, name: "Dropped Image" });
        return;
      }

      // Try fetching & converting URL to base64 Data URL for persistent offline storage
      try {
        const res = await fetch(cleanUrl);
        const blob = await res.blob();
        if (blob && blob.size <= 20 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => {
            const isVideo = blob.type.startsWith("video/") || Boolean(cleanUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i));
            onWallpaperPick({
              type: isVideo ? "video" : "image",
              dataUrl: String(reader.result),
              name: "Dropped Media"
            });
          };
          reader.readAsDataURL(blob);
          return;
        }
      } catch {
        /* Fallback to direct URL if CORS blocks blob fetching */
      }

      const isVideo = Boolean(cleanUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i));
      onWallpaperPick({
        type: isVideo ? "video" : "image",
        dataUrl: cleanUrl,
        name: "Online Image"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);

    const dt = e.dataTransfer;
    if (!dt) return;

    // 1. Local File(s) dropped
    if (dt.files && dt.files.length > 0) {
      const file = dt.files[0];
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        onWallpaperPick(file);
        return;
      }
    }

    // 2. Dragged Image URL / Link dropped
    let droppedUrl = dt.getData("text/uri-list") || dt.getData("text/plain");

    if (!droppedUrl && dt.getData("text/html")) {
      const html = dt.getData("text/html");
      const match = html.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        droppedUrl = match[1];
      }
    }

    if (droppedUrl) {
      processDroppedUrl(droppedUrl);
    }
  };

  const normalizePalette = (val) => {
    if (Array.isArray(val) && val.length === 4) return val;
    if (typeof val === "string" && val.startsWith("#")) {
      return [val, val, val, val];
    }
    return ["#CBD5E1", "#64748B", "#334155", "#0F172A"];
  };

  const activeColors = normalizePalette(themeColor);

  return (
    <div className="flex flex-col gap-6">
      {/* Wallpaper */}
      <CardContainer
        title="自定义壁纸"
        description="将图片 / 视频文件或图片链接直接拖放到下方方框，或点击上传。"
        action={
          <div className="flex items-center gap-2">
            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onWallpaperPick(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => wallpaperInputRef.current?.click()}
              className="px-4 py-2 rounded-full bg-[color:var(--accent)] hover:opacity-90 border border-white/20 text-xs text-[color:var(--theme-text,#fff)] font-gilroy-medium cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              上传媒体
            </button>
            {wallpaper && (
              <button
                type="button"
                onClick={onWallpaperReset}
                className="px-4 py-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs text-white/70 hover:text-white font-gilroy-medium cursor-pointer transition-all active:scale-95"
              >
                恢复默认
              </button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Dropzone Container */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => wallpaperInputRef.current?.click()}
            className={`w-full h-52 rounded-[22px] overflow-hidden border-2 transition-all duration-300 relative flex items-center justify-center shadow-xl cursor-pointer group select-none ${
              isDraggingOver
                ? "border-[color:var(--accent)] bg-[color:var(--accent)]/20 scale-[1.01] ring-4 ring-[color:var(--accent)]/30"
                : "border-white/20 hover:border-white/40"
            }`}
          >
            {wallpaper?.dataUrl ? (
              wallpaper.type === "video" ? (
                <video src={wallpaper.dataUrl} className="w-full h-full object-cover pointer-events-none" muted autoPlay loop />
              ) : (
                <img src={wallpaper.dataUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
              )
            ) : (
              <img
                src={
                  {
                    light: "/images/liquid-glass-wallpaper.jpg",
                    default: "/images/default-wallpaper.jpg",
                  }[uiTheme] || "/images/default-wallpaper.jpg"
                }
                alt=""
                className="w-full h-full object-cover object-top pointer-events-none"
              />
            )}

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5 text-white z-10 backdrop-blur-[2px] pointer-events-none">
              <i className="ri-drag-drop-line text-3xl" />
              <p className="text-xs font-gilroy-bold">Drag & Drop Image or Link Here</p>
              <span className="text-[10px] text-white/70 font-gilroy-medium">or click to browse files</span>
            </div>

            {/* Drag active overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-2 text-white animate-fade-in pointer-events-none">
                <i className="ri-upload-cloud-2-line text-4xl text-[color:var(--accent)] animate-bounce" />
                <p className="text-sm font-gilroy-bold">Drop Image or Link to Set Wallpaper</p>
              </div>
            )}

            {/* Processing spinner */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-2 text-white pointer-events-none">
                <i className="ri-loader-4-line text-3xl animate-spin text-[color:var(--accent)]" />
                <p className="text-xs font-gilroy-medium">Processing Image...</p>
              </div>
            )}

            {/* Label badge */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-xs text-white font-gilroy-medium shadow-md z-20 pointer-events-none">
              {wallpaper ? wallpaper.name || "自定义壁纸" : "Default Wallpaper"}
            </div>
          </div>

          {/* Quick Paste Image Link Field */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <span className="text-white/70 text-xs font-gilroy-medium shrink-0">图片链接</span>
            <InputField
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="粘贴图片或视频链接（https://...）"
              className="flex-1"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (urlInput) {
                  processDroppedUrl(urlInput);
                  setUrlInput("");
                }
              }}
              className="px-4 py-2 rounded-full bg-[color:var(--accent)] hover:opacity-90 border border-white/20 text-xs text-[color:var(--theme-text,#fff)] font-gilroy-medium cursor-pointer transition-all active:scale-95 shrink-0"
            >
              应用链接
            </button>
          </div>
        </div>
      </CardContainer>

      {/* Hero Layout Mirror */}
      <CardContainer
        title="Start 界面布局"
        description="调整时钟与快捷 dock 栏、开始按钮的左右位置。"
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "left", label: "时钟在左", desc: "dock 栏与开始按钮在右（默认）", icon: "ri-layout-left-line" },
            { id: "right", label: "时钟在右", desc: "dock 栏与开始按钮在左", icon: "ri-layout-right-line" },
          ].map((opt) => {
            const isSelected = heroLayout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onHeroLayoutChange && onHeroLayoutChange(opt.id)}
                className={`flex flex-col items-start gap-1 p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                  isSelected
                    ? "border-white bg-white/20 ring-2 ring-white/40 shadow-xl"
                    : "border-white/10 bg-black/30 hover:border-white/30 hover:bg-black/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className={`${opt.icon} text-base text-[color:var(--accent)]`} />
                  <span className="text-xs font-gilroy-bold text-white">{opt.label}</span>
                </div>
                <span className="text-[11px] text-white/50">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </CardContainer>

      {/* Theme Sector — UI Style Themes rendered in rich visual cards */}
      <CardContainer
        title="主题分区"
        description="选择完整的界面主题风格，切换背景、玻璃卡片、面板与排版。"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {UI_THEMES.map((t) => {
            const isSelected = uiTheme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => onUiThemeChange && onUiThemeChange(t.id)}
                className={`group rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden relative flex flex-col bg-black/40 shadow-lg ${
                  isSelected
                    ? "border-white ring-2 ring-white/50 scale-[1.02] shadow-2xl"
                    : "border-white/10 hover:border-white/30 hover:bg-black/60"
                }`}
              >
                <div className="h-32 w-full overflow-hidden relative">
                  <img
                    src={t.image}
                    alt={t.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  
                  {/* Corner Beta Overlay Badge */}
                  {t.beta && (
                    <span className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-gilroy-bold uppercase tracking-wider border border-yellow-200/50 shadow-md backdrop-blur-sm flex items-center gap-1 select-none">
                      <i className="ri-flask-line text-[11px]" /> 测试版
                    </span>
                  )}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20">
                      {(themeColorsMap?.[t.id] || t.preview).map((c, i) => (
                        <span
                          key={i}
                          className="h-3.5 w-3.5 border border-white/40 shadow-sm"
                          style={{
                            backgroundColor: c,
                            borderRadius: "50%",
                          }}
                        />
                      ))}
                    </div>
                    {isSelected && (
                      <span className="px-2.5 py-1 rounded-full bg-[color:var(--accent)] text-[color:var(--theme-text,#fff)] text-[10px] font-gilroy-bold border border-white/30 uppercase tracking-wider shadow-md">
                        当前主题
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <i className={`${t.icon} text-sm text-[color:var(--accent)]`} />
                    <h4 className="text-white text-xs font-gilroy-bold group-hover:text-[color:var(--accent)] transition-colors">
                      {t.name}
                    </h4>
                  </div>
                  <p className="text-white/50 text-[11px] font-gilroy-medium line-clamp-2">
                    {t.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContainer>

      {/* Theme Color */}
      <CardContainer
        title="主题强调色板"
        description="选择一套标志性的四色渐变色板（由浅到深），或自定义全部 4 个色阶。"
      >
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {THEME_PRESETS.map((p) => {
            const isSelected = activeColors.every((c, i) => c.toLowerCase() === p.colors[i].toLowerCase());
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onThemeChange(p.colors)}
                className={`h-14 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer active:scale-95 flex p-1 bg-black/40 ${
                  isSelected
                    ? "border-white scale-105 shadow-xl ring-2 ring-white/50"
                    : "border-white/10 opacity-75 hover:opacity-100 hover:border-white/30"
                }`}
              >
                <div className="w-full h-full rounded-xl overflow-hidden flex">
                  {p.colors.map((colorHex, idx) => (
                    <div key={idx} className="flex-1 h-full" style={{ backgroundColor: colorHex }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 pt-3 border-t border-white/10 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-xs font-gilroy-medium">Custom 4-Color Selection</span>
            <span className="text-white/40 text-[11px] font-gilroy-medium">Light → Dark</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activeColors.map((colorHex, idx) => (
              <label
                key={idx}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 cursor-pointer text-xs text-white font-gilroy-medium transition-all active:scale-95 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-4 w-4 rounded-full border border-white/60 shadow-sm shrink-0"
                    style={{ backgroundColor: colorHex }}
                  />
                  <span className="text-[11px] text-white/90 font-mono tracking-wider">{colorHex.toUpperCase()}</span>
                </div>
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => {
                    const updated = [...activeColors];
                    updated[idx] = e.target.value;
                    onThemeChange(updated);
                  }}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Text & Accent Color Selector */}
        <div className="flex flex-col gap-3 pt-3 border-t border-white/10 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-xs font-gilroy-medium">Text & Accent Color</span>
            <span className="text-white/40 text-[11px] font-gilroy-medium">Select from Theme Shades</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activeColors.map((colorHex, idx) => {
              const isSelected = themeTextColorIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onThemeTextColorChange && onThemeTextColorChange(idx)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? "bg-white/20 border-white text-white font-gilroy-bold shadow-md scale-105 ring-2 ring-white/40"
                      : "bg-white/5 hover:bg-white/10 border-white/15 text-white/70"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-4 w-4 rounded-full border border-white/60 shadow-sm shrink-0"
                      style={{ backgroundColor: colorHex }}
                    />
                    <span className="text-[11px] font-mono tracking-wider">{colorHex.toUpperCase()}</span>
                  </div>
                  {isSelected && <i className="ri-check-line text-xs text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      </CardContainer>

      {/* Base Font Selector */}
      <CardContainer
        title="字体选择"
        description="选择本机中文字体作为界面主字体，拉丁字符仍由 Gilroy 渲染。"
        action={
          baseFont && baseFont !== "Gilroy" && baseFont !== "Default" && (
            <button
              type="button"
              onClick={() => onBaseFontChange && onBaseFontChange("Gilroy")}
              className="px-4 py-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/15 text-xs text-white/70 hover:text-white font-gilroy-medium cursor-pointer transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <i className="ri-refresh-line text-xs" />
              恢复默认字体
            </button>
          )
        }
      >
        <div className="flex flex-col gap-5">
          {/* Active Font Showcase Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-white/10 via-black/40 to-black/30 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[color:var(--accent)] border border-white/30 text-[10px] font-bold text-[color:var(--theme-text,#fff)] uppercase tracking-wider shadow-md">
                  当前字体
                </span>
                <span className="text-xs text-white/60 font-medium truncate">{baseFont || "Gilroy"}</span>
              </div>
              <p
                className="text-lg sm:text-xl font-medium text-white truncate mt-0.5"
                style={{ fontFamily: baseFont === "Gilroy" ? "Gilroy" : cnFontStack(baseFont) }}
              >
                永东国爱，时光荏苒；白驹过隙 123
              </p>
            </div>
            <div className="shrink-0 text-right sm:border-l sm:border-white/10 sm:pl-4">
              <span className="text-[10px] text-white/40 block">字符预览</span>
              <span
                className="text-base sm:text-lg text-white/90 tracking-widest font-bold"
                style={{ fontFamily: baseFont === "Gilroy" ? "Gilroy" : cnFontStack(baseFont) }}
              >
                永 Aa 123
              </span>
            </div>
          </div>


          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1.5 scrollbar-hide">
            {filteredFonts.map((f) => {
              const isSelected = (baseFont || "Gilroy").toLowerCase() === f.name.toLowerCase();
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => onBaseFontChange && onBaseFontChange(f.name)}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer relative group ${
                    isSelected
                      ? "border-white bg-white/20 ring-2 ring-white/40 shadow-xl scale-[1.01]"
                      : "border-white/10 bg-black/30 hover:border-white/30 hover:bg-black/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs font-bold text-white truncate">{f.name}</span>
                      {f.cat && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-white/10 text-white/60">
                          {f.cat}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="h-5 w-5 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--theme-text,#fff)] shrink-0 ml-1 shadow-sm">
                        <i className="ri-check-line text-xs font-bold" />
                      </span>
                    )}
                  </div>

                  <p
                    className="text-sm text-white/90 truncate my-1.5"
                    style={{ fontFamily: f.name === "Gilroy" ? "Gilroy" : cnFontStack(f.css || f.name) }}
                  >
                    永东国爱，时光荏苒 • Aa 123
                  </p>

                  <span className="text-[10px] text-white/40 truncate w-full">
                    {f.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContainer>

    </div>
  );
};


/* ─── TAB 3: Song Player Settings ─── */
const SongPlayerTab = ({
  songAutoPlay, onSongAutoPlayChange,
  musicSources, onMusicSourcesChange,
  lofiVolume = 80, onLofiVolumeChange,
  pianoVolume = 80, onPianoVolumeChange,
}) => {
  const [videoDirName, setVideoDirName] = useState("");
  const [videoDirMsg, setVideoDirMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const handle = await getHandle(SONG_VIDEO_DIR_KEY);
        if (!alive || !handle) return;
        const perm = await queryPermission(handle);
        if (perm === "granted") setVideoDirName(handle.name || "已选择");
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const handlePickVideoDir = async () => {
    try {
      const handle = await pickDirectory("project-os-song-video");
      await saveHandle(SONG_VIDEO_DIR_KEY, handle);
      emitVideoReload();
      setVideoDirName(handle.name || "已选择");
      setVideoDirMsg("");
    } catch (err) {
      setVideoDirMsg(err?.message || "选择失败");
    }
  };

  const handleUpdateSource = (id, field, value) => {
    if (!onMusicSourcesChange) return;
    onMusicSourcesChange((musicSources || []).map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleAddRadio = () => {
    if (!onMusicSourcesChange) return;
    onMusicSourcesChange([...(musicSources || []), {
      id: `stream-${Date.now()}`,
      type: "radio",
      name: "新音频流",
      streamUrl: "",
    }]);
  };

  const handleAddLocalMusic = async () => {
    if (!onMusicSourcesChange) return;
    try {
      const handle = await pickDirectory(`project-os-music-${Date.now()}`);
      const dirKey = `${SONG_MUSIC_DIR_PREFIX}${Date.now()}`;
      await saveHandle(dirKey, handle);
      onMusicSourcesChange([...(musicSources || []), {
        id: `local-${Date.now()}`,
        type: "local",
        name: handle.name || "本地音乐",
        dirKey,
      }]);
    } catch {}
  };

  const handleRemoveSource = (id) => {
    if (!onMusicSourcesChange) return;
    // 不再限制「至少保留一个」——本机 bundled 音乐由 SongPlayer 自动注入兜底。
    onMusicSourcesChange((musicSources || []).filter((s) => s.id !== id));
  };

  const handleResetSources = () => {
    if (!onMusicSourcesChange) return;
    onMusicSourcesChange(DEFAULT_MUSIC_SOURCES);
  };

  return (
    <div className="flex flex-col gap-6">
      <CardContainer
        title="音乐源管理"
        description="管理本地默认音乐与已添加的音频流，使用播放器上/下按钮在源之间切换。"
      >
        <div className="flex flex-col gap-5 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-music-2-line text-sm text-[color:var(--accent)]" />
              <span className="text-white/90 text-xs font-gilroy-bold">音乐源列表</span>
            </div>
            <button type="button" onClick={handleResetSources}
              className="text-[11px] text-white/60 hover:text-white underline cursor-pointer transition-colors shrink-0 ml-2">
              恢复默认
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto scrollbar-hide pr-1 mt-1">
            {(musicSources || []).map((source, idx) => (
              <div key={source.id}
                className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-black/25 border border-white/10 hover:border-white/20 transition-all shadow-sm group">
                <div className="h-9 w-9 rounded-xl bg-[color:var(--accent)]/20 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
                  <i className={`${source.type === "radio" ? "ri-cast-line" : "ri-folder-music-line"} text-sm text-white/80`} />
                </div>
                <div className="flex-1 min-w-0">
                  <InputField
                    value={source.name || ""}
                    onChange={(e) => handleUpdateSource(source.id, "name", e.target.value)}
                    placeholder="名称"
                    className="w-full mb-1"
                  />
                  {source.type === "radio" && (
                    <InputField
                      value={source.streamUrl || ""}
                      onChange={(e) => handleUpdateSource(source.id, "streamUrl", e.target.value)}
                      placeholder="音频流地址（https://...）"
                      className="w-full"
                    />
                  )}
                  {source.type === "local" && (
                    <p className="text-white/40 text-[10.5px] font-gilroy-medium truncate">
                      本地文件夹 · {source.dirKey}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => handleRemoveSource(source.id)}
                  className="h-9 w-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/10 cursor-pointer transition-all flex items-center justify-center shrink-0 active:scale-95"
                  title="删除">
                  <i className="ri-delete-bin-6-line text-sm" />
                </button>
              </div>
            ))}

            <div className="flex gap-2 mt-1">
              <button type="button" onClick={handleAddRadio}
                className="flex-1 py-3 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 border border-white/20 text-xs text-[color:var(--theme-text,#fff)] font-gilroy-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-md">
                <i className="ri-cast-line text-base" />
                <span>添加音频流</span>
              </button>
              <button type="button" onClick={handleAddLocalMusic}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-white font-gilroy-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-md">
                <i className="ri-folder-music-line text-base" />
                <span>添加本地音乐</span>
              </button>
            </div>
          </div>
        </div>
      </CardContainer>

      <CardContainer
        title="待机视频背景"
        description="选择一个包含 Wallpaper_Presence 视频的文件夹，播放器将按时段自动切换动画。"
      >
        <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <i className="ri-vidicon-line text-sm text-[color:var(--accent)]" />
            <span className="text-white/90 text-xs font-gilroy-bold">视频文件夹</span>
          </div>
          <p className="text-white/50 text-[11px] font-gilroy-medium leading-relaxed">
            选择一个包含 Wallpaper_Presence 视频的文件夹，播放器将按时段自动切换循环与过渡。
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePickVideoDir}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0">
              <i className="ri-folder-open-line text-sm" />
              <span>{videoDirName ? "更换文件夹" : "选择视频文件夹"}</span>
            </button>
            {videoDirName && (
              <span className="text-white/70 text-xs font-gilroy-medium">{videoDirName}</span>
            )}
          </div>
          {videoDirMsg && <p className="text-red-400 text-[11px]">{videoDirMsg}</p>}
        </div>
      </CardContainer>

      <CardContainer title="通用设置" description="音量与自动播放选项">
        <div className="flex flex-col gap-4 pt-3 border-t border-white/10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white/90 text-xs font-gilroy-medium">背景音量</span>
                <p className="text-white/50 text-[11px] font-gilroy-medium">待机/休息时的背景音频音量</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-mono font-bold text-white">
                {lofiVolume}%
              </span>
            </div>
            <input type="range" min="0" max="100" value={lofiVolume}
              onChange={(e) => onLofiVolumeChange && onLofiVolumeChange(Number(e.target.value))}
              className="w-full h-1.5 accent-[color:var(--accent)] cursor-pointer" />
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white/90 text-xs font-gilroy-medium">视频音量</span>
                <p className="text-white/50 text-[11px] font-gilroy-medium">播放钢琴视频时的音量</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-mono font-bold text-white">
                {pianoVolume}%
              </span>
            </div>
            <input type="range" min="0" max="100" value={pianoVolume}
              onChange={(e) => onPianoVolumeChange && onPianoVolumeChange(Number(e.target.value))}
              className="w-full h-1.5 accent-[color:var(--accent)] cursor-pointer" />
          </div>


          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div>
              <span className="text-white/90 text-xs font-gilroy-medium">自动播放</span>
              <p className="text-white/50 text-[11px] font-gilroy-medium">打开界面时自动开始播放</p>
            </div>
            <Toggle checked={songAutoPlay} onChange={onSongAutoPlayChange} />
          </div>
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── TAB 5.6: Image Carousel ─── */
const CarouselTab = ({ carouselConfig, onCarouselConfigChange }) => {
  const links = Array.isArray(carouselConfig?.links) ? carouselConfig.links : [];
  const [urlDraft, setUrlDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderMsg, setFolderMsg] = useState("");
  const [supported, setSupported] = useState(true);

  const update = (patch) =>
    onCarouselConfigChange && onCarouselConfigChange({ ...carouselConfig, ...patch });

  useEffect(() => {
    let alive = true;
    (async () => {
      setSupported(fsAccessSupported());
      try {
        const h = await getHandle(CAROUSEL_DIR_KEY);
        if (alive && h) setFolderName(h.name || "已选文件夹");
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const chooseFolder = async () => {
    setFolderMsg("");
    try {
      const handle = await pickDirectory();
      await saveHandle(CAROUSEL_DIR_KEY, handle);
      setFolderName(handle.name || "已选文件夹");
      const perm = await queryPermission(handle);
      setFolderMsg(
        perm === "granted"
          ? "已保存，小组件会读取该文件夹内的图片"
          : "已保存，回到仪表盘后点击「授权并读取」即可"
      );
    } catch (err) {
      setFolderMsg(err?.name === "AbortError" ? "已取消选择" : `选择失败：${err?.message || err}`);
    }
  };

  const clearFolder = async () => {
    try {
      await deleteHandle(CAROUSEL_DIR_KEY);
    } catch {}
    setFolderName("");
    setFolderMsg("已清除文件夹设置");
  };

  const addLink = () => {
    const url = urlDraft.trim();
    if (!url) return;
    update({
      links: [...links, { id: `c-${Date.now()}`, url, name: nameDraft.trim() || url, enabled: true }],
    });
    setUrlDraft("");
    setNameDraft("");
  };
  const removeLink = (id) => update({ links: links.filter((l) => l.id !== id) });
  const toggleLink = (id) =>
    update({ links: links.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)) });

  const pageHint = "网络图片链接，与本地文件夹、JSON 索引合并显示。";
  return (
    <div className="flex flex-col gap-5">
      <CardContainer
        title="本地图片文件夹"
        description="选择电脑上的图片文件夹，直接轮播其中的图片，无需上传到网络。"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-11 px-4 rounded-2xl bg-black/40 border border-white/15 flex items-center min-w-0">
              <i className="ri-folder-open-line text-sm text-white/40 shrink-0 mr-2" />
              <span className="text-xs text-white/80 truncate">
                {folderName || (supported ? "未选择文件夹" : "当前浏览器不支持文件夹选择")}
              </span>
            </div>
            <button
              type="button"
              onClick={chooseFolder}
              disabled={!supported}
              className="h-11 px-5 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 text-[color:var(--theme-text,#fff)] text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md border border-white/20 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-folder-add-line text-sm" />
              选择文件夹
            </button>
            {folderName && (
              <button
                type="button"
                onClick={clearFolder}
                className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-red-500/60 active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white shrink-0 cursor-pointer"
                title="清除文件夹设置"
              >
                <i className="ri-delete-bin-6-line text-sm" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/90 text-xs font-gilroy-medium">包含子文件夹</span>
            <Toggle
              checked={carouselConfig?.folderRecursive !== false}
              onChange={(v) => update({ folderRecursive: v })}
            />
          </div>

          {folderMsg && <p className="text-[11px] text-white/50">{folderMsg}</p>}
          {!supported && (
            <p className="text-[11px] text-white/40">
              文件夹选择需要 Chrome / Edge 86 及以上版本，或改用下方的网络图片链接。
            </p>
          )}
        </div>
      </CardContainer>


      <CardContainer
        title="轮播参数"
        description="切换间隔与淡入淡出时长。"
      >
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-xs font-gilroy-medium">切换间隔</span>
          <div className="flex items-center gap-1.5">
            {[5, 8, 15, 30].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ intervalSec: v })}
                className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                  Number(carouselConfig?.intervalSec) === v
                    ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                    : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {v} 秒
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <span className="text-white/90 text-xs font-gilroy-medium">淡入淡出时长</span>
          <div className="flex items-center gap-1.5">
            {[300, 600, 1000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ fadeMs: v })}
                className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                  Number(carouselConfig?.fadeMs) === v
                    ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                    : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {v} ms
              </button>
            ))}
          </div>
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── TAB 5.5: RSS Subscription ─── */
import { fetchFeedText } from "../utils/rss";
const RssTab = ({ rssConfig, onRssConfigChange }) => {
  const feeds = Array.isArray(rssConfig?.feeds) ? rssConfig.feeds : [];
  const [urlDraft, setUrlDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const update = (patch) => onRssConfigChange && onRssConfigChange({ ...rssConfig, ...patch });

  const addFeed = () => {
    const url = urlDraft.trim();
    if (!url) return;
    const name = nameDraft.trim() || (hostOfRss(url));
    update({ feeds: [...feeds, { id: `rss-${Date.now()}`, url, name, enabled: true }] });
    setUrlDraft("");
    setNameDraft("");
    setTestResult(null);
  };

  const testFeed = async () => {
    const url = urlDraft.trim();
    if (!url) { setTestResult({ ok: false, msg: "请先填写订阅地址" }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const { text, proxy } = await fetchFeedText(url);
      const items = (text.match(/<item[\s>]/gi) || text.match(/<entry[\s>]/gi) || []).length;
      setTestResult({ ok: true, msg: `可用 · 通过 ${proxy} · 解析到 ${items} 条` });
    } catch (err) {
      setTestResult({ ok: false, msg: `失败 · ${err?.message || err}` });
    }
    setTesting(false);
  };

  const removeFeed = (id) => update({ feeds: feeds.filter((f) => f.id !== id) });

  const toggleFeed = (id) =>
    update({ feeds: feeds.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)) });

  return (
    <div className="flex flex-col gap-5">
      <CardContainer
        title="订阅源管理"
        description="添加 RSS / Atom 订阅源，小组件将聚合显示各源最新内容。"
      >
        <div className="flex flex-col gap-3">
          {feeds.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/15"
            >
              <button
                type="button"
                onClick={() => toggleFeed(f.id)}
                className={`h-5 w-9 rounded-full relative transition-all cursor-pointer shrink-0 border ${
                  f.enabled ? "bg-[color:var(--accent)] border-white/40" : "bg-white/10 border-white/20"
                }`}
                title={f.enabled ? "点击停用" : "点击启用"}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                    f.enabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-gilroy-bold text-white truncate">{f.name}</span>
                <span className="text-[10px] text-white/40 truncate">{f.url}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFeed(f.id)}
                className="h-7 w-7 rounded-full bg-white/10 hover:bg-red-500/60 active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white shrink-0 cursor-pointer"
                title="删除该订阅源"
              >
                <i className="ri-delete-bin-6-line text-sm" />
              </button>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="RSS / Atom 订阅链接（https://…）"
                className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
              />
              <button
                type="button"
                onClick={testFeed}
                disabled={testing}
                className="h-11 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-white/15 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? <i className="ri-loader-4-line text-sm animate-spin" /> : <i className="ri-shield-check-line text-sm" />}
                {testing ? "测试中" : "测试"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="名称（可选，默认用域名）"
                className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
              />
              <button
                type="button"
                onClick={addFeed}
                className="h-11 px-5 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 text-[color:var(--theme-text,#fff)] text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md border border-white/20 shrink-0"
              >
                <i className="ri-add-line text-sm" />
                添加订阅
              </button>
            </div>
            {testResult && (
              <p className={`text-[11px] font-gilroy-medium ${testResult.ok ? "text-green-300/80" : "text-red-300/80"}`}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
              </p>
            )}
          </div>
        </div>
      </CardContainer>

      <CardContainer
        title="刷新与显示"
        description="设置自动刷新间隔与小组件内显示的条目数。"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-xs font-gilroy-medium">自动刷新间隔</span>
            <div className="flex items-center gap-1.5">
              {[15, 30, 60].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ intervalMin: v })}
                  className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                    Number(rssConfig?.intervalMin) === v
                      ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                      : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {v} 分钟
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-xs font-gilroy-medium">显示条数</span>
            <div className="flex items-center gap-1.5">
              {[5, 8, 15].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ maxItems: v })}
                  className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                    Number(rssConfig?.maxItems) === v
                      ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                      : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {v} 条
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContainer>
    </div>
  );
};

const hostOfRss = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/* ─── TAB: Home Assistant ─── */
const HaTab = ({ haConfig, onHaConfigChange }) => {
  const entities = Array.isArray(haConfig?.entities) ? haConfig.entities : [];
  const [draftBase, setDraftBase] = useState(haConfig?.baseUrl || "");
  const [draftToken, setDraftToken] = useState(haConfig?.token || "");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");
  const [discovered, setDiscovered] = useState([]);

  const update = (patch) => onHaConfigChange && onHaConfigChange({ ...haConfig, ...patch });

  const ensurePermission = async (rawUrl) => {
    let origin = null;
    try {
      origin = new URL(rawUrl).origin + "/";
    } catch {
      return;
    }
    if (typeof chrome !== "undefined" && chrome.permissions?.request) {
      try {
        await chrome.permissions.request({ origins: [origin] });
      } catch {}
    }
  };

  const test = async () => {
    const cleanBase = draftBase.trim().replace(/\/+$/, "");
    if (!cleanBase || !draftToken.trim()) {
      setMsg("请先填写 Home Assistant 地址与访问令牌");
      return;
    }
    setTesting(true);
    setMsg("");
    setDiscovered([]);
    try {
      await ensurePermission(cleanBase);
      const message = await testConnection(cleanBase, draftToken.trim());
      setMsg(`连接成功：${message}`);
      update({ baseUrl: cleanBase, token: draftToken.trim() });
      const states = await fetchStates(cleanBase, draftToken.trim());
      const list = filterSupported(states);
      setDiscovered(list);
      if (entities.length === 0) update({ baseUrl: cleanBase, token: draftToken.trim(), entities: list.map((e) => e.entity_id) });
      else if (list.length === 0) setMsg(`连接成功：${message}，但没有发现可控制的设备`);
    } catch (err) {
      setMsg(`连接失败：${err?.message || err}`);
    } finally {
      setTesting(false);
    }
  };

  const toggleEntity = (id) =>
    update({
      entities: entities.includes(id) ? entities.filter((e) => e !== id) : [...entities, id],
    });

  const allSelected =
    discovered.length > 0 && discovered.every((e) => entities.includes(e.entity_id));
  const toggleSelectAll = () => {
    if (allSelected) {
      // 取消全选
      update({ entities: [] });
    } else {
      // 全选：把所有已发现设备加入 entities（保留之前手选的、已下线的 device id 不在 discovered 里）
      update({ entities: discovered.map((e) => e.entity_id) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <CardContainer
        title="连接信息"
        description="填写 Home Assistant 的访问地址与长期访问令牌（HA → 个人资料 → 安全 → 长期访问令牌）。"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={draftBase}
            onChange={(e) => setDraftBase(e.target.value)}
            placeholder="http://192.168.1.42:8123"
            className="w-full h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
          />
          <div className="flex items-center gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
              placeholder="长期访问令牌"
              className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white shrink-0 cursor-pointer"
              title={showToken ? "隐藏令牌" : "显示令牌"}
            >
              <i className={showToken ? "ri-eye-off-line text-sm" : "ri-eye-line text-sm"} />
            </button>
            <button
              type="button"
              onClick={test}
              disabled={testing}
              className="h-11 px-5 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 text-[color:var(--theme-text,#fff)] text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md border border-white/20 shrink-0 disabled:opacity-50"
            >
              <i className={testing ? "ri-loader-4-line text-sm animate-spin" : "ri-links-line text-sm"} />
              测试连接
            </button>
          </div>
          {msg && (
            <p className={`text-[11px] ${msg.startsWith("连接失败") ? "text-red-300/80" : "text-white/50"}`}>
              {msg}
            </p>
          )}
        </div>
      </CardContainer>

      <CardContainer
        title="设备选择"
        description="连接成功后会列出可控制的设备，取消勾选即可在小组件中隐藏。最多支持灯具、开关、风扇、温控、窗帘、场景、脚本等。"
      >
        {discovered.length === 0 ? (
          <p className="text-[11px] text-white/40 py-2">
            {entities.length > 0 ? `已保存 ${entities.length} 个设备，点击「测试连接」可重新发现设备。` : "点击上方「测试连接」后显示设备列表。"}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
              <span className="text-[11px] text-white/55">
                已选 <span className="text-white font-gilroy-bold">{entities.length}</span> / {discovered.length}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className={`text-[11px] font-gilroy-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer active:scale-95 ${
                  allSelected
                    ? "bg-white/15 hover:bg-white/25 border-white/30 text-white"
                    : "bg-[color:var(--accent)]/20 hover:bg-[color:var(--accent)]/30 border-white/20 text-[color:var(--theme-text,#fff)]"
                }`}
              >
                {allSelected ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto scrollbar-hide pr-1">
              {discovered.map((e) => {
                const meta = DOMAIN_META[domainOf(e.entity_id)] || { icon: "ri-device-line", label: "设备" };
                const checked = entities.includes(e.entity_id);
                return (
                  <button
                    key={e.entity_id}
                    type="button"
                    onClick={() => toggleEntity(e.entity_id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all cursor-pointer text-left ${
                      checked ? "bg-[color:var(--accent)]/20 border-white/25" : "bg-black/30 border-white/10 hover:bg-black/50"
                    }`}
                  >
                    <i className={`${meta.icon} text-sm text-white/60 shrink-0`} />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-gilroy-bold text-white truncate">
                        {e.attributes?.friendly_name || e.entity_id}
                      </span>
                      <span className="text-[9px] text-white/35 truncate">{e.entity_id}</span>
                    </span>
                    <i className={`${checked ? "ri-checkbox-circle-fill text-[color:var(--theme-1,var(--accent))]" : "ri-checkbox-blank-circle-line text-white/30"} text-base shrink-0`} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContainer>

      <CardContainer title="刷新间隔" description="小组件自动刷新设备状态的频率。">
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-xs font-gilroy-medium">自动刷新</span>
          <div className="flex items-center gap-1.5">
            {[10, 30, 60].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ intervalSec: v })}
                className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                  Number(haConfig?.intervalSec) === v
                    ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                    : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {v} 秒
              </button>
            ))}
          </div>
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── TAB 4: Taskbar Shortcuts ─── */
const TaskbarTab = ({
  shortcuts, onShortcutUpdate, onShortcutRemove, onShortcutAdd, onShortcutIconPick, onShortcutsReorder, uiTheme = "default",
}) => {
  const [iconPickerShortcutId, setIconPickerShortcutId] = useState(null);
  const buttonRefs = useRef({});

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const anyPickerOpen = iconPickerShortcutId !== null;

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...shortcuts];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, moved);
    if (typeof onShortcutsReorder === "function") {
      onShortcutsReorder(updated);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Taskbar Shortcuts */}
      <CardContainer
        overflowVisible={anyPickerOpen}
        title="任务栏快捷启动"
        description="在顶部任务栏自定义 AI 工具、开发者书签与 Web 链接。按住卡片拖动可调整顺序。"
        action={
          <button
            type="button"
            onClick={onShortcutAdd}
            className="px-3.5 py-2 rounded-2xl bg-[color:var(--accent)] hover:brightness-110 text-[color:var(--theme-text,#fff)] font-gilroy-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md whitespace-nowrap shrink-0"
          >
            <i className="ri-add-line text-sm relative z-10" />
            <span className="relative z-10">添加快捷方式</span>
          </button>
        }
      >
        <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
          {(shortcuts || []).map((s, idx) => {
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-black/25 border rounded-2xl transition-all shadow-sm relative ${
                  iconPickerShortcutId === s.id ? "z-30 overflow-visible" : "z-10 overflow-hidden"
                } ${
                  isDragging
                    ? "opacity-40 border-dashed border-white/40 scale-[0.99]"
                    : isDragOver
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 scale-[1.01]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3">
                  {/* Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/80 transition-colors p-1 shrink-0 flex items-center justify-center"
                    title="拖拽调整顺序"
                  >
                    <i className="ri-drag-move-fill text-base" />
                  </div>

                  {/* Icon Button with Inline Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      ref={(el) => (buttonRefs.current[s.id] = el)}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIconPickerShortcutId(iconPickerShortcutId === s.id ? null : s.id);
                      }}
                      className="h-10 w-10 rounded-2xl bg-[color:var(--accent)]/20 hover:bg-[color:var(--accent)]/40 border border-white/20 flex items-center justify-center text-[color:var(--theme-text,#fff)] transition-all cursor-pointer shrink-0 group/ic active:scale-95 shadow-inner"
                      title="更换图标"
                    >
                      {s.iconDataUrl || s.iconUrl ? (
                        <img src={s.iconDataUrl || s.iconUrl} alt="" className="h-5 w-5 object-contain" />
                      ) : s.iconClass && (s.iconClass.startsWith("img:") || s.iconClass.startsWith("http") || s.iconClass.startsWith("data:")) ? (
                        <img src={s.iconClass.replace(/^img:/, "")} alt="" className="h-5 w-5 object-contain" />
                      ) : s.iconClass ? (
                        <i className={`${s.iconClass} text-white text-xl group-hover/ic:scale-110 transition-transform`} />
                      ) : (
                        <i className="ri-link text-white text-xl" />
                      )}
                    </button>

                    {iconPickerShortcutId === s.id && (
                      <IconDropdownPopover
                        triggerRef={{ current: buttonRefs.current[s.id] }}
                        current={s.iconClass}
                        onSelect={(ic) => onShortcutUpdate(s.id, { iconClass: ic, iconDataUrl: null, iconUrl: null })}
                        onClose={() => setIconPickerShortcutId(null)}
                        uiTheme={uiTheme}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <InputField
                      value={s.title ?? ""}
                      onChange={(e) => onShortcutUpdate(s.id, { title: e.target.value })}
                      placeholder="标题"
                      className="w-full"
                    />
                    <InputField
                      value={s.url ?? ""}
                      onChange={(e) => onShortcutUpdate(s.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`sc-icon-${s.id}`}
                      onChange={(e) => onShortcutIconPick(s.id, e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById(`sc-icon-${s.id}`)?.click()}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                      title="上传图片作为图标"
                    >
                      <i className="ri-image-line text-xs" />
                      <span className="hidden sm:inline">上传图片</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShortcutRemove(s.id)}
                      className="h-9 w-9 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-white/50 hover:text-red-400 cursor-pointer transition-all flex items-center justify-center shrink-0 active:scale-95"
                      title="删除快捷方式"
                    >
                      <i className="ri-delete-bin-6-line text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── TAB 4: Important Tabs ─── */
const ImportantTabsTab = ({ _showImportantTabs, _onShowImportantTabsChange, importantTabsConfig, onImportantTabsConfigChange, uiTheme = "default" }) => {
  const [iconPickerTabId, setIconPickerTabId] = useState(null);
  const [expandedTabId, setExpandedTabId] = useState(null);
  const buttonRefs = useRef({});

  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const anyPickerOpen = iconPickerTabId !== null;

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...importantTabsConfig];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, moved);
    onImportantTabsConfigChange(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const addTab = () => {
    const newTab = { id: makeId(), title: "New Tab Group", iconClass: "ri-globe-line", links: [] };
    onImportantTabsConfigChange([...importantTabsConfig, newTab]);
    setExpandedTabId(newTab.id);
  };

  const removeTab = (id) => onImportantTabsConfigChange(importantTabsConfig.filter((t) => t.id !== id));

  const updateTab = (id, patch) =>
    onImportantTabsConfigChange(importantTabsConfig.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addLink = (tabId) => {
    const tab = importantTabsConfig.find((t) => t.id === tabId);
    if (!tab) return;
    updateTab(tabId, {
      links: [...tab.links, { id: makeId(), label: "链接", url: "https://" }],
    });
  };

  const removeLink = (tabId, linkId) => {
    const tab = importantTabsConfig.find((t) => t.id === tabId);
    if (!tab) return;
    updateTab(tabId, { links: tab.links.filter((l) => l.id !== linkId) });
  };

  const updateLink = (tabId, linkId, patch) => {
    const tab = importantTabsConfig.find((t) => t.id === tabId);
    if (!tab) return;
    updateTab(tabId, {
      links: tab.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    });
  };

  return (
    <CardContainer
      overflowVisible={anyPickerOpen}
      title="收藏夹分组"
      description="将多个网站链接整理为一键打开的标签分组。上下拖动卡片可调整顺序。"
    >
      <div className="flex flex-col gap-4 pt-3 border-t border-white/10">
        <div className="flex flex-col gap-4">
          {(importantTabsConfig || []).map((tab, idx) => {
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-black/25 border rounded-2xl transition-all shadow-sm relative ${
                  iconPickerTabId === tab.id ? "z-30 overflow-visible" : "z-10 overflow-hidden"
                } ${
                  isDragging
                    ? "opacity-40 border-dashed border-white/40 scale-[0.99]"
                    : isDragOver
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 scale-[1.01]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3">
                  {/* Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/80 transition-colors p-1 shrink-0 flex items-center justify-center"
                    title="拖拽调整顺序"
                  >
                    <i className="ri-drag-move-fill text-base" />
                  </div>

                  {/* Icon Button with Inline Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      ref={(el) => (buttonRefs.current[tab.id] = el)}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIconPickerTabId(iconPickerTabId === tab.id ? null : tab.id);
                      }}
                      className="h-10 w-10 rounded-2xl bg-[color:var(--accent)]/25 hover:bg-[color:var(--accent)]/45 border border-white/20 flex items-center justify-center text-[color:var(--theme-text,#fff)] text-xl transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
                      title="更换图标"
                    >
                      {tab.iconClass && (tab.iconClass.startsWith("img:") || tab.iconClass.startsWith("http") || tab.iconClass.startsWith("data:")) ? (
                        <img src={tab.iconClass.replace(/^img:/, "")} alt="" className="h-5 w-5 object-contain" />
                      ) : (
                        <i className={`${tab.iconClass || "ri-globe-line"} relative z-10`} />
                      )}
                    </button>

                    {iconPickerTabId === tab.id && (
                      <IconDropdownPopover
                        triggerRef={{ current: buttonRefs.current[tab.id] }}
                        current={tab.iconClass}
                        onSelect={(ic) => updateTab(tab.id, { iconClass: ic })}
                        onClose={() => setIconPickerTabId(null)}
                        uiTheme={uiTheme}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <InputField
                      value={tab.title}
                      onChange={(e) => updateTab(tab.id, { title: e.target.value })}
                      placeholder="分组标题"
                      className="w-full font-gilroy-bold"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setExpandedTabId(expandedTabId === tab.id ? null : tab.id)}
                      className="h-10 px-3.5 rounded-2xl bg-[color:var(--accent)]/25 hover:bg-[color:var(--accent)]/45 border border-white/20 text-xs text-[color:var(--theme-text,#fff)]/80 hover:text-[color:var(--theme-text,#fff)] cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                    >
                      <span className="text-xs font-gilroy-medium">{tab.links?.length || 0} links</span>
                      <i className={`ri-arrow-${expandedTabId === tab.id ? "up" : "down"}-s-line text-sm relative z-10`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTab(tab.id)}
                      className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-white/50 hover:text-red-400 cursor-pointer transition-all flex items-center justify-center shrink-0 active:scale-95"
                      title="删除分组"
                    >
                      <i className="ri-delete-bin-6-line text-sm" />
                    </button>
                  </div>
                </div>

                {expandedTabId === tab.id && (
                  <div className="border-t border-white/10 p-3 bg-black/20 flex flex-col gap-2">
                    {tab.links?.map((link) => (
                      <div key={link.id} className="flex items-center gap-2.5">
                        <i className="ri-corner-down-right-line text-white/40 text-sm shrink-0 ml-1.5" />
                        <div className="w-36 shrink-0">
                          <InputField
                            value={link.label}
                            onChange={(e) => updateLink(tab.id, link.id, { label: e.target.value })}
                            placeholder="名称（如：文档）"
                            className="w-full h-9 rounded-xl text-xs bg-black/30 border-white/10"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <InputField
                            value={link.url}
                            onChange={(e) => updateLink(tab.id, link.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full h-9 rounded-xl text-xs bg-black/30 border-white/10"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLink(tab.id, link.id)}
                          className="h-9 w-9 rounded-xl hover:bg-red-500/20 text-white/40 hover:text-red-400 cursor-pointer flex items-center justify-center shrink-0 transition-all active:scale-95"
                          title="删除链接"
                        >
                          <i className="ri-close-line text-base" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addLink(tab.id)}
                      className="mt-1.5 self-start px-4 py-1.5 rounded-xl bg-[color:var(--accent)] hover:opacity-90 border border-white/20 text-xs text-[color:var(--theme-text,#fff)] font-gilroy-medium cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <i className="ri-add-line text-xs relative z-10" />
                      <span className="relative z-10">添加链接</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addTab}
          className="w-full py-3 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 border border-white/20 text-xs text-[color:var(--theme-text,#fff)] font-gilroy-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md mt-1"
        >
          <i className="ri-add-line text-base relative z-10" />
          <span className="relative z-10">添加标签页分组</span>
        </button>
      </div>
    </CardContainer>
  );
};

/* ─── TAB 5: Calendar Subscription ─── */
const CalendarTab = ({ calendarSub, onCalendarSubChange, onShowTimeBoxingChange, showTimeBoxing }) => {
  const feeds = Array.isArray(calendarSub?.feeds) ? calendarSub.feeds : [];
  const [urlDraft, setUrlDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [permissionState, setPermissionState] = useState("");

  const update = (patch) => onCalendarSubChange && onCalendarSubChange({ ...calendarSub, ...patch });

  const hostOfCal = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  };

  const addFeed = () => {
    const url = urlDraft.trim();
    if (!url) return;
    const name = nameDraft.trim() || hostOfCal(url);
    update({ feeds: [...feeds, { id: `cal-${Date.now()}`, url, name, enabled: true }] });
    setUrlDraft("");
    setNameDraft("");
    setTestResult(null);
  };

  const removeFeed = (id) => update({ feeds: feeds.filter((f) => f.id !== id) });

  const toggleFeed = (id) =>
    update({ feeds: feeds.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)) });

  const testFeed = async () => {
    const url = urlDraft.trim();
    if (!url) { setTestResult({ ok: false, msg: "请先填写订阅地址" }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const items = (text.match(/BEGIN:VEVENT/g) || []).length;
      setTestResult({ ok: true, msg: `可用 · 解析到 ${items} 个事件` });
      setPermissionState("测试通过，可保存到列表");
    } catch (err) {
      setTestResult({ ok: false, msg: `失败 · ${err?.message || err}` });
    }
    setTesting(false);
  };

  const requestAccess = async (origin) => {
    if (typeof chrome !== "undefined" && chrome.permissions?.request) {
      try {
        const granted = await chrome.permissions.request({ origins: [origin] });
        setPermissionState(granted ? "已获得该日历域名的访问权限" : "未授权，可能无法获取订阅内容");
      } catch {
        setPermissionState("浏览器未要求额外授权");
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">

      <CardContainer
        title="订阅源管理"
        description="添加 ICS 日历订阅链接（Google 日历：设置 → 集成日历 → iCal 格式的公开地址）。"
      >
        <div className="flex flex-col gap-3">
          {feeds.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/15"
            >
              <button
                type="button"
                onClick={() => toggleFeed(f.id)}
                className={`h-5 w-9 rounded-full relative transition-all cursor-pointer shrink-0 border ${
                  f.enabled ? "bg-[color:var(--accent)] border-white/40" : "bg-white/10 border-white/20"
                }`}
                title={f.enabled ? "点击停用" : "点击启用"}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                    f.enabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-gilroy-bold text-white truncate">{f.name}</span>
                <span className="text-[10px] text-white/40 truncate">{f.url}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFeed(f.id)}
                className="h-7 w-7 rounded-full bg-white/10 hover:bg-red-500/60 active:scale-95 transition-all flex items-center justify-center text-white/70 hover:text-white shrink-0 cursor-pointer"
                title="删除该订阅源"
              >
                <i className="ri-delete-bin-6-line text-sm" />
              </button>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="ICS 订阅链接（https://…）"
                className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
              />
              <button
                type="button"
                onClick={testFeed}
                disabled={testing}
                className="h-11 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-white/15 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? <i className="ri-loader-4-line text-sm animate-spin" /> : <i className="ri-shield-check-line text-sm" />}
                {testing ? "测试中" : "测试"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="名称（可选，默认用域名）"
                className="flex-1 h-11 rounded-2xl bg-black/40 border border-white/15 focus:border-white/40 px-4 text-xs text-white placeholder:text-white/30 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  addFeed();
                  const url = urlDraft.trim();
                  if (!url) return;
                  let origin = null;
                  try { origin = new URL(url).origin + "/"; } catch {}
                  if (origin) requestAccess(origin);
                }}
                className="h-11 px-5 rounded-2xl bg-[color:var(--accent)] hover:opacity-90 text-[color:var(--theme-text,#fff)] text-xs font-gilroy-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md border border-white/20 shrink-0"
              >
                <i className="ri-add-line text-sm" />
                添加订阅
              </button>
            </div>
            {testResult && (
              <p className={`text-[11px] font-gilroy-medium ${testResult.ok ? "text-green-300/80" : "text-red-300/80"}`}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
              </p>
            )}
            {permissionState && !testResult && (
              <p className="text-[11px] text-white/50">{permissionState}</p>
            )}
          </div>
        </div>
      </CardContainer>

      <CardContainer
        title="刷新与显示"
        description="设置自动刷新间隔与小组件内显示的日程条数。"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-xs font-gilroy-medium">自动刷新间隔</span>
            <div className="flex items-center gap-1.5">
              {[15, 30, 60].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ intervalMin: v })}
                  className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                    Number(calendarSub?.intervalMin) === v
                      ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                      : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {v} 分钟
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-xs font-gilroy-medium">显示条数</span>
            <div className="flex items-center gap-1.5">
              {[5, 8, 15].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update({ maxEvents: v })}
                  className={`px-3 py-1 rounded-full text-xs font-gilroy-bold transition-all cursor-pointer border ${
                    Number(calendarSub?.maxEvents) === v
                      ? "bg-[color:var(--accent)] border-[color:var(--accent)] text-[color:var(--theme-text,#fff)]"
                      : "bg-black/30 border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {v} 条
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── TAB 6: Widget Visibility ─── */
const WidgetsTab = ({
  uiTheme,
  showSongPlayer, onShowSongPlayerChange,
  showTodo, onShowTodoChange,
  showImportantTabs, onShowImportantTabsChange,
  showTimeBoxing, onShowTimeBoxingChange,
  showRssReader, onShowRssReaderChange,
  showHaWidget, onShowHaWidgetChange,
  showCarousel, onShowCarouselChange,
  widgetEditMode, onWidgetEditModeChange,
}) => {
  const isManga = false;
  const accentStyle = {
    backgroundColor: isManga ? "#000000" : "var(--accent)",
    borderColor: isManga ? "#000000" : "var(--accent)",
  };
  const idleStyle = {
    borderColor: isManga ? "#000000" : "color-mix(in srgb, var(--theme-1, var(--accent)) 35%, transparent)",
  };

  return (
    <>
      <CardContainer
        title="仪表盘小组件显示"
        description="控制主仪表盘网格上显示哪些小组件与工具。"
      >
        <div className="flex flex-col gap-1 pt-3 border-t border-white/10">
          {[
            { title: "播放器", desc: "统一音乐源（在线流+本地）与时段视频背景", state: showSongPlayer, set: onShowSongPlayerChange, icon: "ri-music-2-line" },
            { title: "便签", desc: "便签与任务清单卡片", state: showTodo, set: onShowTodoChange, icon: "ri-file-text-line" },
            { title: "常用分类", desc: "分类快捷书签与链接", state: showImportantTabs, set: onShowImportantTabsChange, icon: "ri-bookmark-3-line" },
            { title: "日历订阅", desc: "在线日历日程小组件", state: showTimeBoxing, set: onShowTimeBoxingChange, icon: "ri-calendar-line" },
            { title: "新消息", desc: "聚合 RSS / Atom 订阅源内容", state: showRssReader, set: onShowRssReaderChange, icon: "ri-rss-line" },
            { title: "照片", desc: "按设定间隔自动轮播图片", state: showCarousel, set: onShowCarouselChange, icon: "ri-image-line" },
            { title: "家庭", desc: "Home Assistant 设备快捷开关", state: showHaWidget, set: onShowHaWidgetChange, icon: "ri-home-gear-line" },
          ].map((w, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[color:var(--accent)]/20 border border-white/15 flex items-center justify-center text-[color:var(--theme-text,#fff)] text-base shrink-0 shadow-inner">
                  <i className={`${w.icon} relative z-10`} />
                </div>
                <div>
                  <h4 className="text-white text-xs font-gilroy-bold">{w.title}</h4>
                  <p className="text-white/50 text-[11px] font-gilroy-medium">{w.desc}</p>
                </div>
              </div>
              <Toggle checked={w.state} onChange={w.set} />
            </div>
          ))}
        </div>
      </CardContainer>

      <CardContainer
        title="布局调整"
      >
        <div className="flex items-center justify-between py-3 px-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[color:var(--accent)]/20 border border-white/15 flex items-center justify-center text-[color:var(--theme-text,#fff)] text-base shrink-0 shadow-inner">
              <i className="ri-draggable relative z-10" />
            </div>
            <div>
              <h4 className="text-white text-xs font-gilroy-bold">悬停手柄调整大小</h4>
              <p className="text-white/50 text-[11px] font-gilroy-medium">
                仅鼠标悬停的小组件显示手柄，不影响平时浏览
              </p>
            </div>
          </div>
          <Toggle checked={Boolean(widgetEditMode)} onChange={onWidgetEditModeChange} />
        </div>
      </CardContainer>

      </>
  );
};

/* ─── Backup & Data Management Tab Component ─── */
const BackupTab = ({ uiTheme }) => {
  const [statusMsg, setStatusMsg] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setStatusMsg(null);
      const data = await exportAllStorageData();

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lively-dashboard-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: "success",
        text: "备份文件已成功导出并下载！请妥善保存。",
      });
    } catch (err) {
      console.error("导出失败：", err);
      setStatusMsg({
        type: "error",
        text: "导出数据失败：" + (err?.message || String(err)),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setStatusMsg(null);

      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Invalid file format. Must be a valid JSON file.");
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid backup payload structure. Expected a JSON object.");
      }

      await importAllStorageData(parsed);

      setStatusMsg({
        type: "success",
        text: "所有设置、待办、小组件与偏好已成功恢复！仪表盘即将刷新…",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error("导入失败：", err);
      setStatusMsg({
        type: "error",
        text: "恢复备份失败：" + (err?.message || String(err)),
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleResetData = async () => {
    try {
      setIsResetting(true);
      await clearAllStorageData();
      setStatusMsg({
        type: "success",
        text: "仪表盘已恢复默认设置，正在刷新…",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: "重置数据失败：" + (err?.message || String(err)),
      });
    } finally {
      setIsResetting(false);
      setShowConfirmReset(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-gilroy-bold flex items-center gap-3 animate-fade-in ${
            statusMsg.type === "success"
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
              : "bg-rose-500/20 border-rose-500/40 text-rose-200"
          }`}
        >
          <i
            className={`text-lg ${
              statusMsg.type === "success"
                ? "ri-checkbox-circle-fill text-emerald-400"
                : "ri-error-warning-fill text-rose-400"
            }`}
          />
          <span className="flex-1">{statusMsg.text}</span>
          {statusMsg.type === "success" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-emerald-500/30 hover:bg-emerald-500/50 rounded-xl text-[11px] font-gilroy-bold transition-all cursor-pointer"
            >
              立即刷新
            </button>
          )}
        </div>
      )}

      {/* Export Section */}
      <CardContainer
        title="导出设置与数据"
        description="下载完整备份：基础设置、高级设置、偏好、自定义壁纸、小组件布局与时间规划日程。"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[color:var(--accent)]/20 border border-white/15 flex items-center justify-center text-[color:var(--theme-text,#fff)] text-lg shrink-0 shadow-inner">
              <i className="ri-download-cloud-2-line" />
            </div>
            <div>
              <h4 className="text-white text-xs font-gilroy-bold">备份文件（JSON）</h4>
              <p className="text-white/50 text-[11px] font-gilroy-medium">
                生成包含仪表盘全部数据的可移植备份文件。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-gilroy-bold text-[color:var(--theme-text,#fff)] bg-[color:var(--accent)] hover:opacity-90 border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md disabled:opacity-50"
          >
            <i className="ri-download-2-line text-sm" />
            <span>{isExporting ? "正在导出…" : "导出备份（.json）"}</span>
          </button>
        </div>
      </CardContainer>

      {/* Restore / Import Section */}
      <CardContainer
        title="恢复 / 载入设置与数据"
        description="载入此前导出的备份文件，立即恢复全部设置、自定义布局、小组件位置与偏好。"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[color:var(--accent)]/20 border border-white/15 flex items-center justify-center text-[color:var(--theme-text,#fff)] text-lg shrink-0 shadow-inner">
              <i className="ri-upload-cloud-2-line" />
            </div>
            <div>
              <h4 className="text-white text-xs font-gilroy-bold">上传备份文件</h4>
              <p className="text-white/50 text-[11px] font-gilroy-medium">
                从本机选择此前导出的 .json 备份文件。
              </p>
            </div>
          </div>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-gilroy-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md disabled:opacity-50"
            >
              <i className="ri-upload-2-line text-sm" />
              <span>{isImporting ? "正在恢复…" : "恢复备份（.json）"}</span>
            </button>
          </div>
        </div>
      </CardContainer>

      {/* Factory Reset Section */}
      <CardContainer
        title="重置全部仪表盘数据"
        description="永久清除所有已保存数据，并将仪表盘重置为初始默认状态。"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 text-lg shrink-0 shadow-inner">
              <i className="ri-delete-bin-line" />
            </div>
            <div>
              <h4 className="text-white text-xs font-gilroy-bold">恢复出厂设置</h4>
              <p className="text-white/50 text-[11px] font-gilroy-medium">
                清除扩展与浏览器存储中的全部数据。
              </p>
            </div>
          </div>

          {!showConfirmReset ? (
            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-gilroy-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <i className="ri-refresh-line text-xs" />
              <span>全部恢复默认</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetData}
                disabled={isResetting}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-gilroy-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
              >
                {isResetting ? "Resetting..." : "Confirm Reset"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-3 py-2 rounded-xl text-xs font-gilroy-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 transition-all cursor-pointer"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </CardContainer>
    </div>
  );
};

/* ─── Main Full-Fledged Settings Screen ─── */
const SettingsPage = (props) => {
  const [activeTab, setActiveTab] = useState("appearance");

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/60 backdrop-blur-md text-white font-gilroy-medium overflow-hidden pointer-events-auto animate-fade-in"
      onClick={props.onClose}
    >
      {/* Settings Full-Screen SaaS Pop-Up Container with Figma Glass background */}
      <div
        className="figma-glass-static w-full h-full max-w-[1360px] max-h-[90vh] rounded-[28px] sm:rounded-[32px] border-0 shadow-2xl flex flex-col overflow-hidden text-white font-gilroy-medium relative z-10 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar matching App header close controls */}
        <div className="w-full flex items-center justify-between px-6 sm:px-8 py-4 border-b border-white/15 shrink-0 z-30 relative bg-black/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <i className="ri-settings-3-fill text-lg relative z-10" />
            </div>
            <h1 className="text-white text-lg font-gilroy-bold tracking-tight">设置</h1>
          </div>

          {/* Top-right controls: Close button matching Dashboard close button */}
          <button
            type="button"
            onClick={props.onClose}
            className="figma-glass-card h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-all active:scale-95 hover:bg-white/20"
            aria-label="关闭设置"
          >
            <i className="ri-close-line text-xl relative z-10" />
          </button>
        </div>

        {/* Main Full-Fledged Screen Split */}
        <div className="w-full flex-1 flex min-h-0 overflow-hidden z-20 relative">
          {/* Left Sidebar Navigation */}
          <aside className="w-64 sm:w-72 border-r border-white/15 p-6 flex flex-col justify-between shrink-0 select-none bg-black/10">
            <div className="flex flex-col gap-6">
              <nav className="flex flex-col gap-2">
                {NAV_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs transition-all duration-300 ease-out cursor-pointer relative overflow-hidden select-none active:scale-[0.98] ${
                        isActive
                          ? "text-white font-gilroy-bold"
                          : "text-white/60 hover:text-white hover:bg-white/5 font-gilroy-medium"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full shadow-md animate-fade-in" />
                      )}
                      <i className={`${tab.icon} text-base transition-colors duration-300 ${isActive ? "text-white" : "text-white/50"}`} />
                      <span className="relative z-10 transition-colors duration-300">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto scrollbar-hide p-8 sm:p-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="text-white text-xl font-gilroy-bold">
                {NAV_TABS.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>

            {activeTab === "appearance" && (
              <AppearanceTab
                wallpaper={props.wallpaper}
                onWallpaperPick={props.onWallpaperPick}
                onWallpaperReset={props.onWallpaperReset}
                themeColor={props.themeColor}
                themeColorsMap={props.themeColorsMap}
                onThemeChange={props.onThemeChange}
                themeTextColorIndex={props.themeTextColorIndex}
                onThemeTextColorChange={props.onThemeTextColorChange}
                uiTheme={props.uiTheme}
                onUiThemeChange={props.onUiThemeChange}
                baseFont={props.baseFont}
                onBaseFontChange={props.onBaseFontChange}
                baseFontSize={props.baseFontSize}
                onBaseFontSizeChange={props.onBaseFontSizeChange}
                heroLayout={props.heroLayout}
                onHeroLayoutChange={props.onHeroLayoutChange}
              />
            )}

            {activeTab === "songPlayer" && (
              <SongPlayerTab
                songAutoPlay={props.songAutoPlay}
                onSongAutoPlayChange={props.onSongAutoPlayChange}
                musicSources={props.musicSources}
                onMusicSourcesChange={props.onMusicSourcesChange}
                lofiVolume={props.lofiVolume}
                onLofiVolumeChange={props.onLofiVolumeChange}
                pianoVolume={props.pianoVolume}
                onPianoVolumeChange={props.onPianoVolumeChange}
              />
            )}

            {activeTab === "taskbar" && (
              <TaskbarTab
                shortcuts={props.shortcuts}
                onShortcutsReorder={props.onShortcutsChange}
                onShortcutUpdate={props.onShortcutUpdate}
                onShortcutRemove={props.onShortcutRemove}
                onShortcutAdd={props.onShortcutAdd}
                onShortcutIconPick={props.onShortcutIconPick}
                uiTheme={props.uiTheme}
              />
            )}

            {activeTab === "tabs" && (
              <ImportantTabsTab
                importantTabsConfig={props.importantTabsConfig}
                onImportantTabsConfigChange={props.onImportantTabsConfigChange}
                uiTheme={props.uiTheme}
              />
            )}

            {activeTab === "timebox" && (
              <CalendarTab
                calendarSub={props.calendarSub}
                onCalendarSubChange={props.onCalendarSubChange}
                showTimeBoxing={props.showTimeBoxing}
                onShowTimeBoxingChange={props.onShowTimeBoxingChange}
              />
            )}

            {activeTab === "rss" && (
              <RssTab
                rssConfig={props.rssConfig}
                onRssConfigChange={props.onRssConfigChange}
              />
            )}

            {activeTab === "carousel" && (
              <CarouselTab
                carouselConfig={props.carouselConfig}
                onCarouselConfigChange={props.onCarouselConfigChange}
              />
            )}

            {activeTab === "ha" && (
              <HaTab
                haConfig={props.haConfig}
                onHaConfigChange={props.onHaConfigChange}
              />
            )}

            {activeTab === "widgets" && (
              <WidgetsTab
                uiTheme={props.uiTheme}
                showSongPlayer={props.showSongPlayer}
                onShowSongPlayerChange={props.onShowSongPlayerChange}
                showTodo={props.showTodo}
                onShowTodoChange={props.onShowTodoChange}
                showImportantTabs={props.showImportantTabs}
                onShowImportantTabsChange={props.onShowImportantTabsChange}
                showTimeBoxing={props.showTimeBoxing}
                onShowTimeBoxingChange={props.onShowTimeBoxingChange}
                showRssReader={props.showRssReader}
                onShowRssReaderChange={props.onShowRssReaderChange}
                showCarousel={props.showCarousel}
                widgetEditMode={props.widgetEditMode}
                onWidgetEditModeChange={props.onWidgetEditModeChange}
                onShowCarouselChange={props.onShowCarouselChange}
                showHaWidget={props.showHaWidget}
                onShowHaWidgetChange={props.onShowHaWidgetChange}
              />
            )}

            {activeTab === "backup" && (
              <BackupTab uiTheme={props.uiTheme} />
            )}
          </div>
        </main>
      </div>
    </div>
  </div>
  );
};

export default SettingsPage;
