const DB_NAME = "project_os_fs";
const STORE = "handles";
export const CAROUSEL_DIR_KEY = "carouselDir";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|ogg|aac|m4a|wma)$/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov)$/i;

export const SONG_MUSIC_DIR_PREFIX = "song_music_";
export const SONG_VIDEO_DIR_KEY = "song_video_dir";

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbTx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
};

export const saveHandle = (key, handle) => idbTx("readwrite", (s) => s.put(handle, key));
export const getHandle = (key) => idbTx("readonly", (s) => s.get(key));
export const deleteHandle = (key) => idbTx("readwrite", (s) => s.delete(key));

export const fsAccessSupported = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export const pickDirectory = async (idHint = "project-os") => {
  if (!fsAccessSupported()) throw new Error("当前浏览器不支持文件夹选择（需 Chrome / Edge 86+）");
  return window.showDirectoryPicker({ id: idHint, mode: "read" });
};

export const queryPermission = async (handle) => {
  if (!handle?.queryPermission) return "unsupported";
  try {
    return await handle.queryPermission({ mode: "read" });
  } catch {
    return "prompt";
  }
};

export const requestPermission = async (handle) => {
  if (!handle?.requestPermission) return "unsupported";
  try {
    return await handle.requestPermission({ mode: "read" });
  } catch {
    return "denied";
  }
};

const walkFiles = async (dirHandle, out, { extRegex, recursive, max, depth }) => {
  if (out.length >= max || depth > 4) return;
  for await (const [name, entry] of dirHandle.entries()) {
    if (out.length >= max) break;
    if (entry.kind === "directory") {
      if (recursive && depth < 4) await walkFiles(entry, out, { extRegex, recursive, max, depth: depth + 1 });
      continue;
    }
    if (!extRegex.test(name)) continue;
    try {
      const file = await entry.getFile();
      out.push({ url: URL.createObjectURL(file), name, source: "folder" });
    } catch {}
  }
};

export const listImagesFromDir = async (dirHandle, { recursive = true, max = 60 } = {}) => {
  const out = [];
  await walkFiles(dirHandle, out, { extRegex: IMAGE_EXT, recursive, max, depth: 0 });
  return out;
};

export const listAudioFromDir = async (dirHandle, { recursive = true, max = 200 } = {}) => {
  const out = [];
  await walkFiles(dirHandle, out, { extRegex: AUDIO_EXT, recursive, max, depth: 0 });
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
};

export const listVideosFromDir = async (dirHandle, { recursive = true, max = 50 } = {}) => {
  const out = [];
  await walkFiles(dirHandle, out, { extRegex: VIDEO_EXT, recursive, max, depth: 0 });
  return out;
};

// Parse Wallpaper_Presence filename convention:
// Loop:     {State}_R1_{Timecode}.mp4        e.g. A_R1_1200.mp4
// Transition: {State}_Transition_{from}_{to}.mp4  e.g. A_Transition_1200_1730.mp4
// Timecodes: 1200 = day(7-17), 1730 = dusk(17-20), 2000 = night(20-7)
export const parseVideoFilename = (name) => {
  const base = name.replace(/\.[^.]+$/, "");
  const loopMatch = base.match(/^([ABC])_R1_(\d{4})$/);
  if (loopMatch) {
    return { state: loopMatch[1], type: "loop", timecode: loopMatch[2] };
  }
  const transMatch = base.match(/^([ABC])_Transition_(\d{4})_(\d{4})$/);
  if (transMatch) {
    return { state: transMatch[1], type: "transition", from: transMatch[2], to: transMatch[3] };
  }
  return null;
};

export const buildVideoIndex = (videoItems) => {
  const index = { loops: {}, transitions: {} };
  for (const item of videoItems) {
    const parsed = parseVideoFilename(item.name);
    if (!parsed) continue;
    if (parsed.type === "loop") {
      if (!index.loops[parsed.state]) index.loops[parsed.state] = {};
      index.loops[parsed.state][parsed.timecode] = item;
    } else if (parsed.type === "transition") {
      const key = `${parsed.from}_${parsed.to}`;
      if (!index.transitions[parsed.state]) index.transitions[parsed.state] = {};
      index.transitions[parsed.state][key] = item;
    }
  }
  const hasStructured = Object.keys(index.loops).length > 0;
  if (!hasStructured && videoItems.length > 0) {
    index.loops.generic = {};
    videoItems.forEach((item, i) => {
      index.loops.generic[String(i)] = item;
    });
  }
  return index;
};

const VIDEO_RELOAD_EVENT = "project-os:video-dir-changed";
export const emitVideoReload = () => window.dispatchEvent(new CustomEvent(VIDEO_RELOAD_EVENT));
export const onVideoReload = (fn) => {
  window.addEventListener(VIDEO_RELOAD_EVENT, fn);
  return () => window.removeEventListener(VIDEO_RELOAD_EVENT, fn);
};

export const getTimePeriod = () => {
  const h = new Date().getHours();
  if (h >= 7 && h < 17) return "1200";
  if (h >= 17 && h < 20) return "1730";
  return "2000";
};

export const revokeAll = (items) => {
  if (!Array.isArray(items)) return;
  items.forEach((it) => {
    if (it?.source === "folder" && it?.url?.startsWith("blob:")) URL.revokeObjectURL(it.url);
  });
};
