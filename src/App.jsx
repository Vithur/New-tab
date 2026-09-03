import React, { useEffect, useMemo, useRef, useState } from "react";
import Taskbar from "./components/Taskbar.jsx";
import Clock from "./components/Clock.jsx";
import DashboardGrid from "./components/DashboardGrid.jsx";
import HeroView from "./components/HeroView.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import { storageGetMultiple, storageSet } from "./utils/storage.js";
import { CN_FONT_NAMES, cnFontStack } from "./utils/fonts.js";
import { STORAGE_KEY_UI_THEME } from "./themes/index.js";
import DEFAULT_LAYOUT_SEED from "./data/default-layout.json";

const STORAGE = {
  wallpaper: "settings_wallpaper_v1", // legacy key (read once for migration)
  wallpaperByTheme: "settings_wallpaper_by_theme_v1", // { default, light }
  showTodo: "settings_show_todo_v1",
  showSongPlayer: "settings_show_song_player_v1",
  themeColor: "settings_theme_color_v1",
  shortcuts: "settings_shortcuts_v1",
  activeStep: "settings_active_step_v1",
  heroLayout: "settings_hero_layout_v1",
  // new
  showImportantTabs: "settings_show_imp_tabs_v1",
  showTimeBoxing: "settings_show_timebox_v1",
  showRssReader: "settings_show_rss_v1",
  songPlaylistUrl: "settings_song_playlist_v1",
  songAutoPlay: "settings_song_autoplay_v1",
  musicSources: "settings_music_sources_v1",
  lofiVolume: "settings_lofi_volume_v1",
  pianoVolume: "settings_piano_volume_v1",
  importantTabsConfig: "settings_imp_tabs_config_v2",
  calendarSub: "settings_calendar_sub_v1",
  rssConfig: "settings_rss_config_v1",
  haConfig: "settings_ha_config_v1",
  showHaWidget: "settings_show_ha_v1",
  carouselConfig: "settings_carousel_config_v1",
  showCarousel: "settings_show_carousel_v1",
  widgetEditMode: "settings_widget_edit_mode_v1",
  themeTextColorIndex: "settings_theme_text_color_idx_v1",
  uiTheme: STORAGE_KEY_UI_THEME,
  uiThemeMode: "settings_ui_theme_mode_v1", // "auto" | "light" | "dark"
  baseFont: "settings_base_font_v1",
  baseFontSize: "settings_base_font_size_v1",
  themeColorsMap: "settings_theme_colors_map_v1",
};

const getTodayUtcDate = () => new Date().toISOString().slice(0, 10);

const makeId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return String(Date.now() + Math.random());
};

const DEFAULT_SHORTCUTS = [
  { id: "google", title: "Google", url: "https://www.google.com", iconClass: "ri-google-fill" },
  { id: "youtube", title: "YouTube", url: "https://www.youtube.com", iconClass: "ri-youtube-fill" },
  { id: "github", title: "GitHub", url: "https://github.com", iconClass: "ri-github-fill" },
  { id: "chatgpt", title: "ChatGPT", url: "https://chatgpt.com", iconClass: "ri-openai-fill" },
  { id: "gemini", title: "Gemini", url: "https://gemini.google.com", iconClass: "ri-gemini-fill" },
  { id: "notion", title: "Notion", url: "https://www.notion.so", iconClass: "ri-book-open-line" },
  { id: "reddit", title: "Reddit", url: "https://www.reddit.com", iconClass: "ri-reddit-fill" },
];

const DEFAULT_IMPORTANT_TABS = [
  {
    id: "tab-yingyin",
    title: "影音",
    iconClass: "ri-film-line",
    links: [
      { id: "link-yingyin-quark", label: "夸克", url: "http://192.168.1.42:5007/" },
      { id: "link-yingyin-subhd", label: "SubHD", url: "https://subhd.tv/" },
      { id: "link-yingyin-douban", label: "豆瓣电影", url: "https://movie.douban.com/" },
      { id: "link-yingyin-qbit", label: "qBittorrent", url: "http://192.168.1.42:8080/#/" },
    ],
  },
  {
    id: "tab-richang",
    title: "日常",
    iconClass: "ri-fire-line",
    links: [
      { id: "link-richang-porn", label: "Porn", url: "http://192.168.1.42:8098/" },
      { id: "link-richang-javdb", label: "JavDB", url: "https://javdb.com/" },
      { id: "link-richang-hanime", label: "Hanime", url: "https://hanime1.me/" },
      { id: "link-richang-pornhub", label: "Pornhub", url: "https://cn.pornhub.com/recommended?o=time" },
    ],
  },
  {
    id: "tab-sheji",
    title: "设计",
    iconClass: "ri-palette-line",
    links: [
      { id: "link-sheji-huaban", label: "花瓣", url: "https://huaban.com/follow" },
      { id: "link-sheji-behance", label: "Behance", url: "https://www.behance.net/galleries/graphic-design" },
      { id: "link-sheji-artstation", label: "ArtStation", url: "https://www.artstation.com/" },
    ],
  },
  {
    id: "tab-tupian",
    title: "图片",
    iconClass: "ri-image-line",
    links: [
      { id: "link-tupian-wallhaven", label: "Wallhaven", url: "https://wallhaven.cc/search?categories=111&purity=010&atleast=2560x1080&sorting=date_added&order=desc&page=4" },
      { id: "link-tupian-misskon", label: "MissKon", url: "https://misskon.com/" },
      { id: "link-tupian-nsfw", label: "NSFW", url: "https://wallhere.com/zh/tag/5268" },
      { id: "link-tupian-gentleman", label: "绅士漫画", url: "https://www.wnacg.com/albums-index-cate-10.html" },
    ],
  },
  {
    id: "tab-zhineng",
    title: "智能",
    iconClass: "ri-robot-line",
    links: [
      { id: "link-zhineng-perplexity", label: "Perplexity", url: "https://www.perplexity.ai/" },
      { id: "link-zhineng-grok", label: "Grok", url: "https://grok.com/" },
      { id: "link-zhineng-gemini", label: "Gemini", url: "https://gemini.google.com/app" },
    ],
  },
  {
    id: "tab-zixun",
    title: "资讯",
    iconClass: "ri-newspaper-line",
    links: [
      { id: "link-zixun-github", label: "GitHub Trending", url: "https://github.com/trending?since=daily" },
      { id: "link-zixun-goodcase", label: "GoodCase", url: "https://goodcase.ai/#rankings" },
      { id: "link-zixun-huggingface", label: "Hugging Face", url: "https://huggingface.co/" },
    ],
  },
  {
    id: "tab-youxi",
    title: "游戏",
    iconClass: "ri-gamepad-line",
    links: [
      { id: "link-youxi-nexus", label: "Nexus", url: "https://www.nexusmods.com/" },
      { id: "link-youxi-fling", label: "FLiNG Trainer", url: "https://flingtrainer.com/category/trainer/" },
      { id: "link-youxi-anheihe", label: "暗黑核", url: "https://www.d2core.com/d4/builds" },
    ],
  },
  {
    id: "tab-ruanjian",
    title: "软件",
    iconClass: "ri-apps-line",
    links: [
      { id: "link-ruanjian-ziyuan", label: "资源荟萃", url: "https://linux.do/tags/c/resource/14/%E5%A4%B8%E5%85%8B%E7%BD%91%E7%9B%98" },
      { id: "link-ruanjian-guoke", label: "果核剥壳", url: "https://www.ghxi.com/category/all/pcsoft" },
      { id: "link-ruanjian-macosicon", label: "macOS Icons", url: "https://macosicons.com/#/" },
    ],
  },
];

// 默认音乐源：空数组。本地默认音乐（Wallpaper Ambience 打包音频）由 SongPlayer 自动注入为首项。
// 用户仍可在「设置 → 音乐播放器」中添加任意链接源/本地文件夹源，UI 不再强调「电台」。
export const DEFAULT_MUSIC_SOURCES = [];

// 默认 RSS / 日历订阅（零配置即可用）
export const DEFAULT_RSS_FEEDS = [
  { id: "aihot-virxact", url: "https://aihot.virxact.com/feed.xml", name: "AI Hot", enabled: true },
];
export const DEFAULT_CALENDAR_FEEDS = [
  { id: "cal-mihomo", url: "https://raw.githubusercontent.com/Vithur/mihomo/main/caldav.ics", name: "番剧日历", enabled: true },
];

const MAX_SHORTCUTS = 12;

export const DEFAULT_THEME_PALETTE = ["#CBD5E1", "#64748B", "#334155", "#0F172A"];

export const DEFAULT_THEME_PALETTES = {
  default: ["#CBD5E1", "#64748B", "#334155", "#0F172A"],
  light: ["#1E293B", "#334155", "#2563EB", "#F1F5F9"],
};

const App = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState("hero");
  const [heroLayout, setHeroLayout] = useState(DEFAULT_LAYOUT_SEED?.heroLayout === "right" ? "right" : "left");

  // existing state
  const [wallpaperByTheme, setWallpaperByTheme] = useState({ default: null, light: null });
  const [showTodo, setShowTodo] = useState(true);
  const [showSongPlayer, setShowSongPlayer] = useState(true);
  const [themeColor, setThemeColor] = useState(Array.isArray(DEFAULT_LAYOUT_SEED?.themeColor) ? DEFAULT_LAYOUT_SEED.themeColor : DEFAULT_THEME_PALETTE);
  const [themeColorsMap, setThemeColorsMap] = useState(
    DEFAULT_LAYOUT_SEED?.themeColorsMap && typeof DEFAULT_LAYOUT_SEED.themeColorsMap === "object"
      ? DEFAULT_LAYOUT_SEED.themeColorsMap
      : DEFAULT_THEME_PALETTES
  );
  const [themeTextColorIndex, setThemeTextColorIndex] = useState(
    Number.isInteger(DEFAULT_LAYOUT_SEED?.themeTextColorIndex) ? DEFAULT_LAYOUT_SEED.themeTextColorIndex : 0
  );
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);

  // new state
  const [showImportantTabs, setShowImportantTabs] = useState(true);
  const [showTimeBoxing, setShowTimeBoxing] = useState(true);
  const [showRssReader, setShowRssReader] = useState(true);



  const [songPlaylistUrl, setSongPlaylistUrl] = useState("");
  const [songAutoPlay, setSongAutoPlay] = useState(DEFAULT_LAYOUT_SEED?.songAutoPlay !== false);
  const [musicSources, setMusicSources] = useState(DEFAULT_MUSIC_SOURCES);
  const [lofiVolume, setLofiVolume] = useState(
    Number.isFinite(DEFAULT_LAYOUT_SEED?.lofiVolume) ? DEFAULT_LAYOUT_SEED.lofiVolume : 20
  );
  const [pianoVolume, setPianoVolume] = useState(
    Number.isFinite(DEFAULT_LAYOUT_SEED?.pianoVolume) ? DEFAULT_LAYOUT_SEED.pianoVolume : 20
  );

  const [importantTabsConfig, setImportantTabsConfig] = useState(
    Array.isArray(DEFAULT_LAYOUT_SEED?.importantTabsConfig) && DEFAULT_LAYOUT_SEED.importantTabsConfig.length > 0
      ? DEFAULT_LAYOUT_SEED.importantTabsConfig
      : DEFAULT_IMPORTANT_TABS
  );
  const [calendarSub, setCalendarSub] = useState(
    DEFAULT_LAYOUT_SEED?.calendarSub && Array.isArray(DEFAULT_LAYOUT_SEED.calendarSub.feeds)
      ? { intervalMin: 30, maxEvents: 8, ...DEFAULT_LAYOUT_SEED.calendarSub }
      : { feeds: DEFAULT_CALENDAR_FEEDS, intervalMin: 30, maxEvents: 8 }
  );
  const [rssConfig, setRssConfig] = useState(
    DEFAULT_LAYOUT_SEED?.rssConfig && Array.isArray(DEFAULT_LAYOUT_SEED.rssConfig.feeds)
      ? { intervalMin: 30, maxItems: 8, ...DEFAULT_LAYOUT_SEED.rssConfig }
      : { feeds: DEFAULT_RSS_FEEDS, intervalMin: 30, maxItems: 8 }
  );
  const [haConfig, setHaConfig] = useState({ baseUrl: "", token: "", entities: [], intervalSec: 30 });
  const [showHaWidget, setShowHaWidget] = useState(true);
  const [carouselConfig, setCarouselConfig] = useState({ links: [], jsonIndexUrl: "", intervalSec: 8, fadeMs: 600 });
  const [showCarousel, setShowCarousel] = useState(true);
  const [widgetEditMode, setWidgetEditMode] = useState(Boolean(DEFAULT_LAYOUT_SEED?.widgetEditMode));
  const [uiTheme, setUiTheme] = useState(
    DEFAULT_LAYOUT_SEED?.uiTheme === "light" ? "light" : "default"
  );
  // "auto" → 跟随系统（prefers-color-scheme）；"light"/"dark" → 手动锁定
  const [uiThemeMode, setUiThemeMode] = useState(() => {
    const seedMode = DEFAULT_LAYOUT_SEED?.uiThemeMode;
    if (seedMode === "auto" || seedMode === "light" || seedMode === "dark") return seedMode;
    return DEFAULT_LAYOUT_SEED?.uiTheme === "light" ? "light" : "dark";
  });
  const [systemPrefersLight, setSystemPrefersLight] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? Boolean(window.matchMedia("(prefers-color-scheme: light)").matches)
      : false
  );
  const [baseFont, setBaseFont] = useState(
    typeof DEFAULT_LAYOUT_SEED?.baseFont === "string" && DEFAULT_LAYOUT_SEED.baseFont.trim()
      ? DEFAULT_LAYOUT_SEED.baseFont
      : "Gilroy"
  );
  const [baseFontSize, setBaseFontSize] = useState(
    Number.isFinite(DEFAULT_LAYOUT_SEED?.baseFontSize) ? DEFAULT_LAYOUT_SEED.baseFontSize : 16
  );

  const [isHydrated, setIsHydrated] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);

  const hydratedRef = useRef(false);

  /* ── Hydration ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const keys = Object.values(STORAGE);
        const data = await storageGetMultiple(keys);

        if (cancelled) return;

        // Wallpaper now lives under `wallpaperByTheme.{default,light}`. Read the
        // new key first; if absent, fall back to the legacy single-key value
        // (so existing users keep their wallpaper on first load after update).
        const storedWallpaperByTheme = data[STORAGE.wallpaperByTheme];
        const storedWallpaperLegacy = data[STORAGE.wallpaper];
        // 无存储值时以种子（固化的默认数据）为底，而不是硬编码空值
        const seedWallpaperByTheme =
          DEFAULT_LAYOUT_SEED?.wallpaperByTheme && typeof DEFAULT_LAYOUT_SEED.wallpaperByTheme === "object"
            ? {
                default: DEFAULT_LAYOUT_SEED.wallpaperByTheme.default || null,
                light: DEFAULT_LAYOUT_SEED.wallpaperByTheme.light || null,
              }
            : { default: null, light: null };
        let nextWallpaperByTheme = seedWallpaperByTheme;
        if (storedWallpaperByTheme && typeof storedWallpaperByTheme === "object") {
          nextWallpaperByTheme = {
            default: storedWallpaperByTheme.default || null,
            light: storedWallpaperByTheme.light || null,
          };
        } else if (storedWallpaperLegacy && typeof storedWallpaperLegacy === "object") {
          nextWallpaperByTheme = { default: storedWallpaperLegacy, light: null };
        }
        setWallpaperByTheme(nextWallpaperByTheme);

        const storedShowTodo = data[STORAGE.showTodo];
        const storedShowSongPlayer = data[STORAGE.showSongPlayer];
        const storedThemeColor = data[STORAGE.themeColor];
        const storedShortcuts = data[STORAGE.shortcuts];
        const storedActiveStepObj = data[STORAGE.activeStep];
        const storedHeroLayout = data[STORAGE.heroLayout];
        const storedShowImpTabs = data[STORAGE.showImportantTabs];
        const storedShowTimeBox = data[STORAGE.showTimeBoxing];
        const storedShowRss = data[STORAGE.showRssReader];
        const storedPlaylist = data[STORAGE.songPlaylistUrl];
        const storedAutoPlay = data[STORAGE.songAutoPlay];
        const storedMusicSources = data[STORAGE.musicSources];
        const storedLofiVolume = data[STORAGE.lofiVolume];
        const storedPianoVolume = data[STORAGE.pianoVolume];
        const storedImpTabsCfg = data[STORAGE.importantTabsConfig];
        const storedCalendarSub = data[STORAGE.calendarSub];
        const storedRssConfig = data[STORAGE.rssConfig];
        const storedHaConfig = data[STORAGE.haConfig];
        const storedShowHa = data[STORAGE.showHaWidget];
        const storedCarouselConfig = data[STORAGE.carouselConfig];
        const storedShowCarousel = data[STORAGE.showCarousel];
        const storedWidgetEditMode = data[STORAGE.widgetEditMode];
        const storedThemeTextIdx = data[STORAGE.themeTextColorIndex];
        const storedUiTheme = data[STORAGE.uiTheme];
        const storedUiThemeMode = data[STORAGE.uiThemeMode];
        const storedBaseFont = data[STORAGE.baseFont];
        const storedBaseFontSize = data[STORAGE.baseFontSize];

        if (typeof storedShowTodo === "boolean") setShowTodo(storedShowTodo);
        if (typeof storedShowSongPlayer === "boolean") setShowSongPlayer(storedShowSongPlayer);
        const storedThemeColorsMap = data[STORAGE.themeColorsMap];
        // 无存储值时以种子（固化的默认数据）为底，而不是硬编码调色板，
        // 否则「恢复默认」会丢掉种子里的主题配色。
        const seedThemeMap =
          DEFAULT_LAYOUT_SEED?.themeColorsMap && typeof DEFAULT_LAYOUT_SEED.themeColorsMap === "object"
            ? { ...DEFAULT_THEME_PALETTES, ...DEFAULT_LAYOUT_SEED.themeColorsMap }
            : { ...DEFAULT_THEME_PALETTES };
        let activeThemeMap = seedThemeMap;
        if (storedThemeColorsMap && typeof storedThemeColorsMap === "object") {
          activeThemeMap = { ...seedThemeMap, ...storedThemeColorsMap };
        } else if (storedThemeColor) {
          if (Array.isArray(storedThemeColor) && storedThemeColor.length === 4) {
            activeThemeMap.default = storedThemeColor;
          } else if (typeof storedThemeColor === "string" && storedThemeColor.trim().startsWith("#")) {
            const c = storedThemeColor.trim();
            activeThemeMap.default = [c, c, c, c];
          }
        }
        setThemeColorsMap(activeThemeMap);

        // 主题模式优先级：用户存储的模式 > 种子默认值（auto）。
        // 未存过模式的老用户升级后即为「跟随系统」，与本次需求一致。
        const seedMode = ["auto", "light", "dark"].includes(DEFAULT_LAYOUT_SEED?.uiThemeMode)
          ? DEFAULT_LAYOUT_SEED.uiThemeMode
          : "auto";
        const nextUiThemeMode =
          storedUiThemeMode === "auto" || storedUiThemeMode === "light" || storedUiThemeMode === "dark"
            ? storedUiThemeMode
            : seedMode;
        setUiThemeMode(nextUiThemeMode);
        const effectiveUiTheme =
          nextUiThemeMode === "auto"
            ? (systemPrefersLight ? "light" : "default")
            : (nextUiThemeMode === "light" ? "light" : "default");
        const activePalette = activeThemeMap[effectiveUiTheme] || DEFAULT_THEME_PALETTES[effectiveUiTheme] || DEFAULT_THEME_PALETTES.default;
        setUiTheme(effectiveUiTheme);
        setThemeColor(activePalette);

        if (typeof storedThemeTextIdx === "number" && storedThemeTextIdx >= 0 && storedThemeTextIdx <= 3) {
          setThemeTextColorIndex(storedThemeTextIdx);
        }
        if (Array.isArray(storedShortcuts) && storedShortcuts.length > 0) setShortcuts(storedShortcuts);

        if (storedActiveStepObj &&
          typeof storedActiveStepObj === "object" &&
          storedActiveStepObj.dateUtc === getTodayUtcDate() &&
          (storedActiveStepObj.step === "dashboard" || storedActiveStepObj.step === "hero")
        ) {
          setActiveStep(storedActiveStepObj.step);
        if (storedHeroLayout === "left" || storedHeroLayout === "right") setHeroLayout(storedHeroLayout);
        } else {
          setActiveStep(DEFAULT_LAYOUT_SEED?.activeStep === "dashboard" ? "dashboard" : "hero");
        }

        if (typeof storedShowImpTabs === "boolean") setShowImportantTabs(storedShowImpTabs);
        if (typeof storedShowTimeBox === "boolean") setShowTimeBoxing(storedShowTimeBox);
        if (typeof storedShowRss === "boolean") setShowRssReader(storedShowRss);
        if (typeof storedPlaylist === "string") setSongPlaylistUrl(storedPlaylist);
        if (typeof storedAutoPlay === "boolean") setSongAutoPlay(storedAutoPlay);
        if (Array.isArray(storedMusicSources) && storedMusicSources.length > 0) {
          // 移除已下架的电台源——默认仅保留本地默认音乐（bunde 由 SongPlayer 自动注入）。
          // 用户的本地文件夹源（type === "local"）不受影响。
          setMusicSources(storedMusicSources.filter((s) => s?.type !== "radio"));
        }
        if (typeof storedLofiVolume === "number" && storedLofiVolume >= 0 && storedLofiVolume <= 100) setLofiVolume(storedLofiVolume);
        if (typeof storedPianoVolume === "number" && storedPianoVolume >= 0 && storedPianoVolume <= 100) setPianoVolume(storedPianoVolume);
        // 兼容旧 {url, intervalMin, maxEvents}：转成新 {feeds:[...], intervalMin, maxEvents}
        const storedCalendar = storedCalendarSub;
        let calendarNext = null;
        if (storedCalendar && typeof storedCalendar === "object") {
          if (Array.isArray(storedCalendar.feeds)) {
            const feeds = storedCalendar.feeds.length > 0 ? storedCalendar.feeds : DEFAULT_CALENDAR_FEEDS;
            calendarNext = { intervalMin: 30, maxEvents: 8, ...storedCalendar, feeds };
          } else if (typeof storedCalendar.url === "string" && storedCalendar.url.trim()) {
            calendarNext = {
              feeds: [
                { id: `cal-${Date.now()}`, url: storedCalendar.url.trim(), name: "我的日历", enabled: true },
              ],
              intervalMin: 30,
              maxEvents: 8,
            };
          }
        }
        if (calendarNext) setCalendarSub(calendarNext);
        else if (!Array.isArray(DEFAULT_LAYOUT_SEED?.calendarSub?.feeds)) setCalendarSub({ feeds: DEFAULT_CALENDAR_FEEDS, intervalMin: 30, maxEvents: 8 });
        if (storedRssConfig && typeof storedRssConfig === "object") {
          // 存储里没有订阅源时，补回默认 RSS
          const feeds = Array.isArray(storedRssConfig.feeds) && storedRssConfig.feeds.length > 0
            ? storedRssConfig.feeds
            : DEFAULT_RSS_FEEDS;
          setRssConfig({ intervalMin: 30, maxItems: 8, ...storedRssConfig, feeds });
        } else if (!Array.isArray(DEFAULT_LAYOUT_SEED?.rssConfig?.feeds)) {
          setRssConfig({ feeds: DEFAULT_RSS_FEEDS, intervalMin: 30, maxItems: 8 });
        }
        if (storedHaConfig && typeof storedHaConfig === "object") {
          setHaConfig({ baseUrl: "", token: "", entities: [], intervalSec: 30, ...storedHaConfig });
        }
        if (typeof storedShowHa === "boolean") setShowHaWidget(storedShowHa);
        if (storedCarouselConfig && typeof storedCarouselConfig === "object") {
          setCarouselConfig({ links: [], jsonIndexUrl: "", intervalSec: 8, fadeMs: 600, ...storedCarouselConfig });
        }
        if (typeof storedShowCarousel === "boolean") setShowCarousel(storedShowCarousel);
        if (typeof storedWidgetEditMode === "boolean") setWidgetEditMode(storedWidgetEditMode);
        let parsedImpTabs = storedImpTabsCfg;
        if (typeof storedImpTabsCfg === "string") {
          try { parsedImpTabs = JSON.parse(storedImpTabsCfg); } catch { parsedImpTabs = null; }
        }
        if (Array.isArray(parsedImpTabs)) setImportantTabsConfig(parsedImpTabs);
        // uiTheme 已由上方「主题模式」统一计算（auto 时跟随系统），此处不再单独覆盖
        if (typeof storedBaseFont === "string" && storedBaseFont.trim()) setBaseFont(storedBaseFont);
        if (typeof storedBaseFontSize === "number" && storedBaseFontSize >= 12 && storedBaseFontSize <= 24) setBaseFontSize(storedBaseFontSize);

        // Mark hydrated BEFORE React flushes the batch above, so persistence
        // effects that fire from these state updates are correctly allowed.
        if (!cancelled) {
          hydratedRef.current = true;
          setIsHydrated(true);
        }
      } catch (err) {
        console.error("应用数据加载失败：", err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /* ── Persistence effects ── */
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.wallpaperByTheme, wallpaperByTheme); }, [wallpaperByTheme]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showTodo, showTodo); }, [showTodo]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showSongPlayer, showSongPlayer); }, [showSongPlayer]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeColor, themeColor); }, [themeColor]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeColorsMap, themeColorsMap); }, [themeColorsMap]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.shortcuts, shortcuts); }, [shortcuts]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    storageSet(STORAGE.activeStep, { step: activeStep, dateUtc: getTodayUtcDate() });
  }, [activeStep]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.heroLayout, heroLayout); }, [heroLayout]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showImportantTabs, showImportantTabs); }, [showImportantTabs]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showTimeBoxing, showTimeBoxing); }, [showTimeBoxing]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showRssReader, showRssReader); }, [showRssReader]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.songPlaylistUrl, songPlaylistUrl); }, [songPlaylistUrl]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.songAutoPlay, songAutoPlay); }, [songAutoPlay]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.musicSources, musicSources); }, [musicSources]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.lofiVolume, lofiVolume); }, [lofiVolume]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.pianoVolume, pianoVolume); }, [pianoVolume]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.importantTabsConfig, importantTabsConfig); }, [importantTabsConfig]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.calendarSub, calendarSub); }, [calendarSub]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.rssConfig, rssConfig); }, [rssConfig]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.haConfig, haConfig); }, [haConfig]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showHaWidget, showHaWidget); }, [showHaWidget]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.carouselConfig, carouselConfig); }, [carouselConfig]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.showCarousel, showCarousel); }, [showCarousel]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.widgetEditMode, widgetEditMode); }, [widgetEditMode]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.themeTextColorIndex, themeTextColorIndex); }, [themeTextColorIndex]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.uiTheme, uiTheme); }, [uiTheme]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.uiThemeMode, uiThemeMode); }, [uiThemeMode]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.baseFont, baseFont); }, [baseFont]);
  useEffect(() => { if (!hydratedRef.current) return; storageSet(STORAGE.baseFontSize, baseFontSize); }, [baseFontSize]);

  /* ── Base Font Loader (local CN fonts first, Google Fonts fallback) ── */
  useEffect(() => {
    if (!baseFont || baseFont === "Gilroy" || baseFont === "Default") {
      document.documentElement.style.setProperty("--font-base-custom", `"Gilroy", sans-serif`);
      return;
    }
    if (CN_FONT_NAMES.includes(baseFont)) {
      document.documentElement.style.setProperty("--font-base-custom", cnFontStack(baseFont));
      return;
    }
    const fontId = `google-font-${baseFont.replace(/\s+/g, "-").toLowerCase()}`;
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(baseFont)}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty("--font-base-custom", `"${baseFont}", sans-serif`);
  }, [baseFont]);

  /* ── Dynamic Base Font Size Property ── */
  useEffect(() => {
    document.documentElement.style.setProperty("--base-font-size", `${baseFontSize}px`);
  }, [baseFontSize]);

  /* ── Apply UI theme to <html> data attribute ── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", uiTheme);
    return () => { document.documentElement.removeAttribute("data-theme"); };
  }, [uiTheme]);

  /* ── 监听系统（OS）亮/暗主题偏好 ── */
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const syncSystemTheme = () => setSystemPrefersLight(Boolean(mq.matches));
    syncSystemTheme();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", syncSystemTheme);
      return () => mq.removeEventListener("change", syncSystemTheme);
    }
    // Safari < 14 / 旧内核兜底
    mq.addListener(syncSystemTheme);
    return () => mq.removeListener(syncSystemTheme);
  }, []);

  /* ── 跟随系统：系统切到浅色→亮色主题，切到深色→暗色主题 ── */
  useEffect(() => {
    if (uiThemeMode !== "auto") return;
    const targetTheme = systemPrefersLight ? "light" : "default";
    setUiTheme(targetTheme);
    const autoPalette =
      (themeColorsMap && themeColorsMap[targetTheme]) ||
      DEFAULT_THEME_PALETTES[targetTheme] ||
      DEFAULT_THEME_PALETTES.default;
    setThemeColor(autoPalette);
  }, [uiThemeMode, systemPrefersLight, themeColorsMap]);

  /* ── Theme CSS variables ── */
  useEffect(() => {
    const colors = Array.isArray(themeColor) && themeColor.length === 4
      ? themeColor
      : ["#CBD5E1", "#64748B", "#334155", "#0F172A"];

    const activeTextColor = colors[themeTextColorIndex] ?? colors[0];

    document.documentElement.style.setProperty("--theme-1", colors[0]);
    document.documentElement.style.setProperty("--theme-2", colors[1]);
    document.documentElement.style.setProperty("--theme-3", colors[2]);
    document.documentElement.style.setProperty("--theme-4", colors[3]);
    document.documentElement.style.setProperty("--theme", colors[2]);
    document.documentElement.style.setProperty("--theme-text", activeTextColor);
    document.documentElement.style.setProperty("--accent", colors[1] ?? colors[0]);
  }, [themeColor, themeTextColorIndex]);

  /* ── Background — uses the wallpaper bound to the *current* theme ── */
  const wallpaper = wallpaperByTheme?.[uiTheme] || null;
  const background = useMemo(() => {
    if (wallpaper?.type === "video" && typeof wallpaper?.dataUrl === "string") {
      return (
        <video
          src={wallpaper.dataUrl}
          className="theme-wallpaper h-full w-full object-cover select-none"
          autoPlay muted loop playsInline
        />
      );
    }
    if (wallpaper?.type === "image" && typeof wallpaper?.dataUrl === "string") {
      return <img src={wallpaper.dataUrl} alt="" className="theme-wallpaper h-full w-full object-cover select-none" />;
    }
    const defaultWallpaperForTheme = {
      light: "/images/liquid-glass-wallpaper.jpg",
      default: "/images/default-wallpaper.jpg",
    }[uiTheme] || "/images/default-wallpaper.jpg";

    return <img src={defaultWallpaperForTheme} alt="" className="theme-wallpaper h-full w-full object-cover select-none object-top" />;
  }, [wallpaper, uiTheme]);

  /* ── Shortcut helpers ── */
  const updateShortcut = (id, patch) =>
    setShortcuts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const removeShortcut = (id) =>
    setShortcuts((prev) => prev.filter((s) => s.id !== id));

  const reorderShortcuts = (fromId, toId) =>
    setShortcuts((prev) => {
      const keyOf = (s) => s.id || s.url;
      const fromIndex = prev.findIndex((s) => keyOf(s) === fromId);
      const toIndex = prev.findIndex((s) => keyOf(s) === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

  const addShortcut = (newShortcut) => {
    setShortcuts((prev) => {
      if (prev.length >= MAX_SHORTCUTS) return prev;
      const item =
        newShortcut && typeof newShortcut === "object" && newShortcut.title
          ? newShortcut
          : { id: makeId(), title: "New", url: "https://" };
      if (!item.id) item.id = makeId();
      return [...prev, item];
    });
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read_error"));
      reader.readAsDataURL(file);
    });

  const handleWallpaperPick = async (fileOrWallpaper) => {
    if (!fileOrWallpaper) return;
    let next = null;
    if (fileOrWallpaper.dataUrl && fileOrWallpaper.type) {
      next = fileOrWallpaper;
    } else {
      const file = fileOrWallpaper;
      const maxBytes = 20 * 1024 * 1024;
      if (file.size > maxBytes) return;
      const dataUrl = await readFileAsDataUrl(file);
      const type = file.type.startsWith("video/") ? "video" : "image";
      next = { type, dataUrl, name: file.name };
    }
    setIsThemeChanging(true);
    setWallpaperByTheme((prev) => ({ ...(prev || {}), [uiTheme]: next }));
    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const handleShortcutIconPick = async (id, file) => {
    if (!file) return;
    const maxBytes = 512 * 1024;
    if (file.size > maxBytes) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateShortcut(id, { iconDataUrl: dataUrl });
  };

  /* ── Smooth Theme & Wallpaper Transition Handlers ── */
  // 手动选择具体主题 → 锁定为该模式（自动退出「跟随系统」）
  const handleUiThemeChange = (newTheme) => {
    setUiThemeMode(newTheme === "light" ? "light" : "dark");
    if (newTheme === uiTheme) return;
    setIsThemeChanging(true);
    setUiTheme(newTheme);

    const targetPalette =
      themeColorsMap[newTheme] ||
      DEFAULT_THEME_PALETTES[newTheme] ||
      DEFAULT_THEME_PALETTES.default;
    setThemeColor(targetPalette);

    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  // 主题模式：auto → 跟随系统亮/暗；light / dark → 手动锁定
  const handleUiThemeModeChange = (mode) => {
    if (mode !== "auto" && mode !== "light" && mode !== "dark") return;
    setUiThemeMode(mode);
    const targetTheme =
      mode === "auto"
        ? (systemPrefersLight ? "light" : "default")
        : (mode === "light" ? "light" : "default");
    if (targetTheme === uiTheme) return;
    setIsThemeChanging(true);
    setUiTheme(targetTheme);

    const targetPalette =
      themeColorsMap[targetTheme] ||
      DEFAULT_THEME_PALETTES[targetTheme] ||
      DEFAULT_THEME_PALETTES.default;
    setThemeColor(targetPalette);

    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  /* ── 把固化的默认数据（src/data/default-layout.json）写回存储 ──
     只覆盖种子里有的字段，不清空存储：壁纸、本地音乐目录、HA 配置、各类缓存均不受影响。 */
  const handleRestoreDefaults = async () => {
    const seed = DEFAULT_LAYOUT_SEED || {};
    const writes = [
      [STORAGE.wallpaperByTheme, seed.wallpaperByTheme && typeof seed.wallpaperByTheme === "object"
        ? seed.wallpaperByTheme : { default: null, light: null }],
      [STORAGE.themeColor, Array.isArray(seed.themeColor) && seed.themeColor.length === 4
        ? seed.themeColor : DEFAULT_THEME_PALETTE],
      [STORAGE.themeColorsMap, seed.themeColorsMap && typeof seed.themeColorsMap === "object"
        ? seed.themeColorsMap : DEFAULT_THEME_PALETTES],
      [STORAGE.themeTextColorIndex, Number.isInteger(seed.themeTextColorIndex) ? seed.themeTextColorIndex : 0],
      [STORAGE.uiTheme, seed.uiTheme === "light" ? "light" : "default"],
      [STORAGE.uiThemeMode, ["auto", "light", "dark"].includes(seed.uiThemeMode) ? seed.uiThemeMode : "auto"],
      [STORAGE.baseFont, typeof seed.baseFont === "string" && seed.baseFont.trim() ? seed.baseFont : "Gilroy"],
      [STORAGE.baseFontSize, Number.isFinite(seed.baseFontSize) ? seed.baseFontSize : 16],
      [STORAGE.lofiVolume, Number.isFinite(seed.lofiVolume) ? seed.lofiVolume : 20],
      [STORAGE.pianoVolume, Number.isFinite(seed.pianoVolume) ? seed.pianoVolume : 20],
      [STORAGE.songAutoPlay, seed.songAutoPlay !== false],
      [STORAGE.importantTabsConfig, Array.isArray(seed.importantTabsConfig) && seed.importantTabsConfig.length > 0
        ? seed.importantTabsConfig : DEFAULT_IMPORTANT_TABS],
      [STORAGE.calendarSub, seed.calendarSub && Array.isArray(seed.calendarSub.feeds)
        ? { intervalMin: 30, maxEvents: 8, ...seed.calendarSub }
        : { feeds: DEFAULT_CALENDAR_FEEDS, intervalMin: 30, maxEvents: 8 }],
      [STORAGE.rssConfig, seed.rssConfig && Array.isArray(seed.rssConfig.feeds)
        ? { intervalMin: 30, maxItems: 8, ...seed.rssConfig }
        : { feeds: DEFAULT_RSS_FEEDS, intervalMin: 30, maxItems: 8 }],
      [STORAGE.heroLayout, seed.heroLayout === "right" ? "right" : "left"],
      [STORAGE.widgetEditMode, Boolean(seed.widgetEditMode)],
      [STORAGE.activeStep, { step: seed.activeStep === "dashboard" ? "dashboard" : "hero", dateUtc: getTodayUtcDate() }],
      ["todo_items_v2", Array.isArray(seed.todoItems) ? seed.todoItems : []],
      ["settings_widget_positions_v7_desktop", seed.positions && typeof seed.positions === "object"
        ? seed.positions : null],
    ];
    for (const [key, value] of writes) {
      if (value === null || value === undefined) continue;
      await storageSet(key, value);
    }
    if (typeof window !== "undefined") window.location.reload();
  };

  const handleThemeColorChange = (newColors) => {
    setThemeColor(newColors);
    setThemeColorsMap((prev) => ({
      ...prev,
      [uiTheme]: newColors,
    }));
  };

  const handleWallpaperChange = async (fileOrWallpaper) => {
    setIsThemeChanging(true);
    await handleWallpaperPick(fileOrWallpaper);
    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const handleWallpaperResetChange = () => {
    setIsThemeChanging(true);
    setWallpaperByTheme((prev) => ({ ...(prev || {}), [uiTheme]: null }));
    setTimeout(() => {
      setIsThemeChanging(false);
    }, 280);
  };

  const showLoader = !isHydrated || isThemeChanging;

  return (
    <div className="theme-bg h-screen w-full bg-black relative overflow-hidden">
      {/* Minimalist Linear/Vercel Aesthetic Loader Overlay */}
      <div
        className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#08080a] transition-opacity duration-300 pointer-events-none ${
          showLoader ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Minimal Monospace Brand Mark */}
          <span className="text-[11px] font-medium tracking-[0.4em] text-white/80 font-mono uppercase">
            L I V E L Y
          </span>

          {/* 2px Micro Shimmer Bar */}
          <div className="w-24 h-[2px] bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 bg-white rounded-full animate-loader-bar" />
          </div>
        </div>
      </div>

      <div className="h-full w-full flex items-center justify-center relative">
        {background}

        {/* Hero View */}
        <HeroView
          shortcuts={shortcuts}
          onStart={() => setActiveStep("dashboard")}
          onOpenSettings={() => setSettingsOpen(true)}
          isVisible={activeStep === "hero"}
          mirrored={heroLayout === "right"}
        />

        {/* Clock */}
        <Clock isDashboard={activeStep === "dashboard"} mirrored={heroLayout === "right"} />

        {/* Taskbar */}
        <div
          className={`absolute top-2.5 left-1/2 -translate-x-1/2 awwwards-motion z-30 ${
            activeStep === "dashboard"
              ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
              : "-translate-y-12 opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <Taskbar
            shortcuts={shortcuts}
            onAddShortcut={addShortcut}
            onRemoveShortcut={removeShortcut}
            onUpdateShortcut={updateShortcut}
            onReorderShortcuts={reorderShortcuts}
          />
        </div>

        {/* Dashboard Grid */}
        <div
          className={`absolute inset-0 z-20 awwwards-motion pointer-events-none ${
            activeStep === "dashboard" ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <DashboardGrid
            showTodo={showTodo}
            showSongPlayer={showSongPlayer}
            showImportantTabs={showImportantTabs}
            showTimeBoxing={showTimeBoxing}
            showRssReader={showRssReader}
            showHaWidget={showHaWidget}
            showCarousel={showCarousel}
            widgetEditMode={widgetEditMode}
            importantTabsConfig={importantTabsConfig}
            calendarSub={calendarSub}
            rssConfig={rssConfig}
            haConfig={haConfig}
            carouselConfig={carouselConfig}
            songPlaylistUrl={songPlaylistUrl}
            songAutoPlay={songAutoPlay}
            musicSources={musicSources}
            lofiVolume={lofiVolume}
            onLofiVolumeChange={setLofiVolume}
            pianoVolume={pianoVolume}
            onPianoVolumeChange={setPianoVolume}
          />
        </div>

        {/* Top Right Controls */}
        <div className="absolute top-2.5 right-5 flex items-center gap-3 pointer-events-auto z-30">
          <div
            className={`awwwards-motion ${
              activeStep === "dashboard"
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-50 pointer-events-none w-0 overflow-hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveStep("hero")}
              className="figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all"
              aria-label="返回主界面"
            >
              <i className="ri-close-line text-[2.8vh] relative z-10" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="figma-glass-card h-[6.5vh] w-[6.5vh] min-h-[42px] min-w-[42px] rounded-full flex items-center justify-center text-white cursor-pointer transition-all"
            aria-label="打开设置"
          >
            <i className="ri-settings-3-fill text-[2.8vh] relative z-10" />
          </button>
        </div>

        {/* Full-screen Settings Page */}
        <SettingsPage
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          // UI Theme & Base Font
          uiTheme={uiTheme}
          onUiThemeChange={handleUiThemeChange}
          uiThemeMode={uiThemeMode}
          onUiThemeModeChange={handleUiThemeModeChange}
          systemPrefersLight={systemPrefersLight}
          onRestoreDefaults={handleRestoreDefaults}
          heroLayout={heroLayout}
          onHeroLayoutChange={setHeroLayout}
          baseFont={baseFont}
          onBaseFontChange={setBaseFont}
          baseFontSize={baseFontSize}
          onBaseFontSizeChange={setBaseFontSize}
          // Wallpaper
          wallpaper={wallpaper}
          onWallpaperPick={handleWallpaperChange}
          onWallpaperReset={handleWallpaperResetChange}
          // Theme
          themeColor={themeColor}
          themeColorsMap={themeColorsMap}
          onThemeChange={handleThemeColorChange}
          themeTextColorIndex={themeTextColorIndex}
          onThemeTextColorChange={setThemeTextColorIndex}
          // Shortcuts
          shortcuts={shortcuts}
          onShortcutsChange={setShortcuts}
          onShortcutUpdate={updateShortcut}
          onShortcutRemove={removeShortcut}
          onShortcutAdd={addShortcut}
          onShortcutIconPick={handleShortcutIconPick}
          // Song Player
          showSongPlayer={showSongPlayer}
          onShowSongPlayerChange={setShowSongPlayer}
          songPlaylistUrl={songPlaylistUrl}
          onSongPlaylistUrlChange={setSongPlaylistUrl}
          songAutoPlay={songAutoPlay}
          onSongAutoPlayChange={setSongAutoPlay}
          musicSources={musicSources}
          onMusicSourcesChange={setMusicSources}
          lofiVolume={lofiVolume}
          onLofiVolumeChange={setLofiVolume}
          pianoVolume={pianoVolume}
          onPianoVolumeChange={setPianoVolume}
          // Notepad
          showTodo={showTodo}
          onShowTodoChange={setShowTodo}
          // Important Tabs
          showImportantTabs={showImportantTabs}
          onShowImportantTabsChange={setShowImportantTabs}
          importantTabsConfig={importantTabsConfig}
          onImportantTabsConfigChange={setImportantTabsConfig}
          // TimeBoxing
          showTimeBoxing={showTimeBoxing}
          onShowTimeBoxingChange={setShowTimeBoxing}
          showRssReader={showRssReader}
          onShowRssReaderChange={setShowRssReader}
          showCarousel={showCarousel}
          onShowCarouselChange={setShowCarousel}
          widgetEditMode={widgetEditMode}
          onWidgetEditModeChange={setWidgetEditMode}
          calendarSub={calendarSub}
          onCalendarSubChange={setCalendarSub}
          rssConfig={rssConfig}
          onRssConfigChange={setRssConfig}
          haConfig={haConfig}
          onHaConfigChange={setHaConfig}
          showHaWidget={showHaWidget}
          onShowHaWidgetChange={setShowHaWidget}
          carouselConfig={carouselConfig}
          onCarouselConfigChange={setCarouselConfig}

          // Streak
        />
      </div>
    </div>
  );
};

export default App;
