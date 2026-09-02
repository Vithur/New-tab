import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  CAROUSEL_DIR_KEY,
  fsAccessSupported,
  getHandle,
  listImagesFromDir,
  queryPermission,
  revokeAll,
} from "../utils/fsAccess.js";
import {
  WIDGET_SHELL,
  WIDGET_HEADER,
  HEADER_TITLE,
  HEADER_DRAG_ICON,
  HEADER_LABEL,
  WIDGET_BODY,
} from "./widgetStyles";
import WidgetEmptyState from "./WidgetEmptyState";

const CACHE_KEY = "settings_carousel_cache_v1";

const CarouselWidget = ({ dragHandleProps, carouselConfig }) => {
  const intervalSec = Math.max(2, Number(carouselConfig?.intervalSec) || 8);
  const fadeMs = Math.max(150, Number(carouselConfig?.fadeMs) || 600);
  const folderRecursive = carouselConfig?.folderRecursive !== false;
  const links = useMemo(
    () => (Array.isArray(carouselConfig?.links) ? carouselConfig.links.filter((l) => l.url) : []),
    [carouselConfig]
  );
  const jsonIndexUrl = (carouselConfig?.jsonIndexUrl || "").trim();

  const [images, setImages] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.images)) return cached.images;
    } catch {}
    return [];
  });

  /*
    Crossfade model — dead simple, no off-by-one:
      • `index`  : which image is currently shown (0..n-1)
      • `prev`   : which image is fading OUT (only set during a transition)
      • `fading` : true while the opacity transition runs

    On each tick:
      1. prev <- index, index <- (index+1) % n, fading <- true
         → BOTH layers are now in the DOM; the new one starts at opacity 0.
      2. next frame: fade the new layer in (CSS transition handles it).
      3. after fadeMs: fading <- false, prev <- -1 (old layer unmounts).

    Because both layers coexist for the whole transition there is never a
    frame where nothing is painted → no black flash.
  */
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [fading, setFading] = useState(false);

  // `mounted` lets the opacity of the *new* layer animate 0 → 1 one frame
  // after it is inserted (otherwise the browser jumps straight to opacity 1).
  const [entered, setEntered] = useState(true);

  const [status, setStatus] = useState("loading");
  const [errored, setErrored] = useState(new Set());
  const [folderPerm, setFolderPerm] = useState("none");

  const dirHandleRef = useRef(null);
  const folderUrlsRef = useRef([]);

  const loadFromJsonIndex = useCallback(async () => {
    if (!jsonIndexUrl) return [];
    try {
      const res = await fetch(jsonIndexUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.images) ? data.images : [];
      return list
        .map((it) => (typeof it === "string" ? { url: it } : { url: it?.url, name: it?.name }))
        .filter((it) => it?.url)
        .map((it) => ({ ...it, source: "json" }));
    } catch {
      return null;
    }
  }, [jsonIndexUrl]);

  const loadFolderImages = useCallback(async () => {
    const handle = dirHandleRef.current;
    if (!handle) return [];
    let perm = await queryPermission(handle);
    if (perm === "prompt") {
      setFolderPerm("prompt");
      return [];
    }
    if (perm !== "granted") {
      setFolderPerm(perm);
      return [];
    }
    setFolderPerm("granted");
    return await listImagesFromDir(handle, { recursive: folderRecursive });
  }, [folderRecursive]);

  const refresh = useCallback(async () => {
    setStatus("loading");
    let folderImages = [];
    try {
      folderImages = await loadFolderImages();
    } catch (err) {
      console.warn("读取本地文件夹失败：", err);
      setFolderPerm("error");
    }
    revokeAll(folderUrlsRef.current);
    folderUrlsRef.current = folderImages;

    const [fromJson] = await Promise.all([loadFromJsonIndex()]);
    const merged = [
      ...folderImages,
      ...links.map((l) => ({ url: l.url, name: l.name, source: "manual" })),
      ...(Array.isArray(fromJson) ? fromJson : []),
    ];
    if (merged.length === 0) {
      // 零配置回退：加载插件打包的默认轮播图（public/media/carousel/）
      try {
        const res = await fetch("/media/carousel/manifest.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const bundled = Array.isArray(data?.images) ? data.images : [];
          if (bundled.length > 0) {
            setImages(bundled.map((it) => ({ ...it, source: "bundled" })));
            setErrored(new Set());
            setStatus("ok");
            setIndex(0);
            setPrev(-1);
            setFading(false);
            setEntered(true);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ images: bundled, at: Date.now() }));
            return;
          }
        }
      } catch {}
      setImages([]);
      setStatus(folderPerm === "prompt" ? "need-permission" : "empty");
      return;
    }
    setImages(merged);
    setErrored(new Set());
    setStatus("ok");
    setIndex(0);
    setPrev(-1);
    setFading(false);
    setEntered(true);
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ images: merged.filter((i) => i.source !== "folder"), at: Date.now() })
    );
  }, [links, loadFromJsonIndex, loadFolderImages, folderPerm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fsAccessSupported()) {
        setFolderPerm("unsupported");
      } else {
        try {
          const handle = await getHandle(CAROUSEL_DIR_KEY);
          if (cancelled) return;
          dirHandleRef.current = handle || null;
          if (!handle) setFolderPerm("none");
        } catch {
          setFolderPerm("none");
        }
      }
      if (!cancelled) refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links.length, jsonIndexUrl, folderRecursive]);

  useEffect(
    () => () => {
      revokeAll(folderUrlsRef.current);
    },
    []
  );

  // 预载每张图进浏览器缓存，让 crossfade 不卡网络。
  // 用 new Image() 而非 <link rel=preload>：后者会在「预载了但未被 <img> 引用」时
  // 抛 "preloaded using link preload but not used" 警告（同一时刻 DOM 只有 cur/prev
  // 两张图，其余被预载的资源永远不被 <img> 实际加载）。new Image() 只走缓存、不报警。
  useEffect(() => {
    if (status !== "ok" || images.length === 0) return undefined;
    const objs = images
      .filter((it) => it.url && !it.url.startsWith("blob:"))
      .map((it) => {
        const im = new Image();
        im.src = it.url;
        return im;
      });
    return () => {
      objs.length = 0;
    };
  }, [images, status]);

  // Advance the carousel. Uses functional updates so the interval always
  // reads the latest index — this is what the previous 3-index version got
  // wrong (it captured a stale nextIdx and ping-ponged between 0 and 1).
  useEffect(() => {
    if (images.length < 2) return undefined;
    const id = setInterval(() => {
      setIndex((cur) => {
        const next = (cur + 1) % images.length;
        setPrev(cur);
        setFading(true);
        setEntered(false);
        // one frame later: animate the new layer in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setEntered(true));
        });
        return next;
      });
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [images.length, intervalSec]);

  // End the fade window once the transition has run.
  useEffect(() => {
    if (!fading) return undefined;
    const id = setTimeout(() => {
      setFading(false);
      setPrev(-1);
    }, fadeMs);
    return () => clearTimeout(id);
  }, [fading, fadeMs]);

  const cur = images[index];
  const prevImg = prev >= 0 ? images[prev] : null;

  return (
    <div className={WIDGET_SHELL}>
      <div className={WIDGET_HEADER}>
        <div className={HEADER_TITLE} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>照片</span>
        </div>
      </div>

      <div className={WIDGET_BODY}>
        <div className="w-full flex-1 min-h-0 rounded-2xl overflow-hidden relative bg-black/70 flex items-center justify-center">
          {status === "empty" && (
            <WidgetEmptyState
              icon="ri-image-line"
              title="尚未添加图片"
              hint="在设置 → 照片中选择本地图片文件夹"
            />
          )}

          {status === "need-permission" && (
            <WidgetEmptyState
              icon="ri-folder-lock-line"
              title="需要重新授权文件夹访问"
              hint="请在设置 → 照片中重新选择文件夹"
            />
          )}

          {/* Outgoing layer — fades 1 → 0 while the new one fades in */}
          {status === "ok" && prevImg && prevImg.url && !errored.has(prevImg.url) && (
            <img
              key={`out-${prev}-${prevImg.url}`}
              src={prevImg.url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                opacity: fading ? 0 : 1,
                transition: `opacity ${fadeMs}ms ease-in-out`,
                zIndex: 1,
              }}
            />
          )}

          {/* Incoming / current layer — fades 0 → 1 then stays at 1 */}
          {status === "ok" && cur && cur.url && !errored.has(cur.url) && (
            <img
              key={`in-${index}-${cur.url}`}
              src={cur.url}
              alt={cur.name || ""}
              onError={() => setErrored((s) => new Set(s).add(cur.url))}
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: entered ? 1 : 0,
                transition: `opacity ${fadeMs}ms ease-in-out`,
                zIndex: 2,
              }}
            />
          )}

          {status === "ok" && cur && cur.url && errored.has(cur.url) && (
            <WidgetEmptyState
              icon="ri-error-warning-line"
              title="图片加载失败"
              hint={cur.name || cur.url}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CarouselWidget;
