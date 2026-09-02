import React, { useState } from "react";

const DEFAULT_TABS = [
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

const BADGE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const badgeOf = (link) =>
  (link.label || domainOf(link.url) || "?").trim().charAt(0).toUpperCase();

const ImportantTabs = ({ dragHandleProps, tabsConfig }) => {
  const tabs = tabsConfig && tabsConfig.length > 0 ? tabsConfig : DEFAULT_TABS;
  const [openGroupId, setOpenGroupId] = useState(null);

  const openLink = (link) => {
    if (link.url && link.url !== "https://") {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  const toggleGroup = (id) =>
    setOpenGroupId((cur) => (cur === id ? null : id));

  return (
    <div className="figma-glass-clean rounded-[26px] px-4 py-3 text-white font-gilroy-medium w-full h-full select-none flex flex-col shadow-2xl relative overflow-hidden">
      {/* Header Row */}
      <div className="w-full flex items-center justify-between z-10 relative shrink-0 mb-3">
        <div
          className="flex items-center gap-2 text-white/70 text-xs font-gilroy-medium cursor-grab active:cursor-grabbing select-none"
          data-drag-handle
          {...dragHandleProps}
        >
          <i className="ri-draggable text-sm pointer-events-none"></i>
          <span className="pointer-events-none">收藏夹</span>
        </div>
        {openGroupId && (
          <button
            type="button"
            onClick={() => setOpenGroupId(null)}
            className="h-6 px-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center gap-1 justify-center text-white/80 text-[11px] shrink-0 cursor-pointer"
            title="折叠全部分组"
          >
            <i className="ri-arrow-up-s-line text-sm"></i>
            <span>收起</span>
          </button>
        )}
      </div>

      {/* 分组列表（始终显示，展开项紧跟在其组下方） */}
      <div className="w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col justify-start gap-0.5 z-10 pr-0.5">
        {tabs.map((tab) => {
          const hasLinks = Array.isArray(tab.links) && tab.links.length > 0;
          const isOpen = openGroupId === tab.id;

          return (
            <React.Fragment key={tab.id}>
              <div className="flex items-center justify-between gap-2.5 text-xs sm:text-sm py-1 cursor-pointer group">
                <div className="flex items-center gap-2.5 min-w-0">
                  {tab.iconClass && (tab.iconClass.startsWith("img:") || tab.iconClass.startsWith("http") || tab.iconClass.startsWith("data:")) ? (
                    <img
                      src={tab.iconClass.replace(/^img:/, "")}
                      alt=""
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <i className={`${tab.iconClass || "ri-globe-line"} text-white/80 text-base shrink-0`} />
                  )}
                  <span className="font-gilroy-medium text-xs sm:text-sm text-white/90 truncate">
                    {tab.title}
                  </span>
                  {hasLinks && (
                    <span className="text-[10px] text-white/35 font-gilroy-medium shrink-0">
                      {tab.links.length}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => hasLinks && toggleGroup(tab.id)}
                  className={`h-6 w-6 rounded-full active:scale-95 transition-all flex items-center justify-center text-white/80 group-hover:border border-white/20 shrink-0 cursor-pointer ${
                    !hasLinks ? "opacity-40 cursor-not-allowed" : ""
                  } ${isOpen ? "bg-white/25 rotate-90" : "bg-white/10"}`}
                  title={!hasLinks ? "尚未添加链接" : (isOpen ? "收起该分组" : "在下方展开链接")}
                >
                  <i className="ri-arrow-right-s-line text-base"></i>
                </button>
              </div>

              {/* 就地展开：链接紧跟在该组下方 */}
              {isOpen && hasLinks && (
                <div className="flex flex-col gap-0.5 pl-2 pb-1.5">
                  {(tab.links || []).map((link, idx) => (
                    <button
                      key={link.id || idx}
                      type="button"
                      onClick={() => openLink(link)}
                      className="flex items-center gap-2.5 py-1 px-1.5 rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group text-left"
                    >
                      <span
                        className="h-5 w-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: BADGE_COLORS[idx % BADGE_COLORS.length] }}
                      >
                        {badgeOf(link)}
                      </span>
                      <span className="font-gilroy-medium text-white/90 truncate flex-1 min-w-0">
                        {link.label || domainOf(link.url)}
                      </span>
                      <span className="text-[10px] text-white/35 truncate max-w-[45%] shrink-0">
                        {domainOf(link.url)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {isOpen && !hasLinks && (
                <div className="text-xs text-white/40 text-center py-2 pl-2">
                  暂无链接
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ImportantTabs;
