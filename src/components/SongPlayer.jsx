import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  WIDGET_SHELL,
  WIDGET_HEADER,
  HEADER_TITLE,
  HEADER_DRAG_ICON,
  HEADER_LABEL,
} from "./widgetStyles";
import {
  getHandle,
  queryPermission,
  listAudioFromDir,
  listVideosFromDir,
  buildVideoIndex,
  getTimePeriod,
  revokeAll,
  SONG_VIDEO_DIR_KEY,
  onVideoReload,
} from "../utils/fsAccess.js";

const STATES = ["A", "B", "C"];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 打包进插件的默认媒体（public/media/ 下），新电脑零配置即可用。
// 清单由 gen_media_manifest 生成到 public/media/manifest.json，
// 内含 Wallpaper_Presence 多状态视频与 Wallpaper_Ambience 音频。
const BUNDLED_MANIFEST_URL = "/media/manifest.json";
const BUNDLED_SOURCE_ID = "bundled-ambience";

// ── 播放态视频源：YouTube 钢琴演奏（已下压 720p 上传 media 仓库）──
// 点击播放 → 随机一段钢琴视频；点击暂停 → 恢复本地待机动画 + 待机音频。
// 清单托管在 media 仓库（CDN 优先，本地打包副本兜底）—— 以后加视频只改仓库，无需重新构建插件
const PIANO_MANIFEST_URL =
  "https://cdn.jsdelivr.net/gh/Vithur/Project-OS-Media@main/media/piano_manifest.json";
const PIANO_MANIFEST_FALLBACK = "/media/piano_manifest.json";

const SongPlayer = ({
  dragHandleProps,
  musicSources = [],
  autoPlay,
  volume = 80,
  onVolumeChange,
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  // isPlaying=true → 钢琴视频模式；false → 本地待机模式（待机动画 + 待机音频）
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [trackName, setTrackName] = useState("");

  const [localTracks, setLocalTracks] = useState([]);
  const [localTrackIdx, setLocalTrackIdx] = useState(0);
  const localUrlsRef = useRef([]);

  const [videoSrc, setVideoSrc] = useState(null);
  const [videoPhase, setVideoPhase] = useState("loop");
  const [videoKey, setVideoKey] = useState(0);
  const [hasVideoIndex, setHasVideoIndex] = useState(false);
  const videoIndexRef = useRef(null);
  const currentStateRef = useRef(pickRandom(STATES));
  const currentPeriodRef = useRef(getTimePeriod());
  const videoUrlsRef = useRef([]);
  const videoRef = useRef(null);

  const [bundledIndex, setBundledIndex] = useState(null);
  const [bundledAudios, setBundledAudios] = useState([]);
  const [bundledAudioIdx, setBundledAudioIdx] = useState(0);

  // 钢琴视频随机播放 + 待机音频静音开关
  const [pianoUrls, setPianoUrls] = useState([]);
  const [pianoUrl, setPianoUrl] = useState(null);
  const [pianoName, setPianoName] = useState("");
  const [pianoKey, setPianoKey] = useState(0);
  const pianoVideoRef = useRef(null);
  const [standbyMuted, setStandbyMuted] = useState(false);

  const audioRef = useRef(null);

  // 打包默认音源：轮换播放 manifest 中的 Wallpaper_Ambience 音频
  const bundledSource = useMemo(() => {
    const url = bundledAudios[bundledAudioIdx]?.url || null;
    return { id: BUNDLED_SOURCE_ID, type: "file", name: "Wallpaper Ambience", url, bundled: true };
  }, [bundledAudios, bundledAudioIdx]);

  const effectiveSources = useMemo(() => {
    if (!musicSources || musicSources.length === 0) return bundledAudios.length ? [bundledSource] : [];
    if (musicSources.some((s) => s.url === bundledSource.url)) return musicSources;
    return [bundledSource, ...musicSources];
  }, [musicSources, bundledSource, bundledAudios.length]);

  const activeSource = effectiveSources[sourceIndex] || effectiveSources[0] || {};
  const isRadio = activeSource.type === "radio";

  // 加载打包媒体清单（新电脑零配置默认源）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BUNDLED_MANIFEST_URL, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.videos) && data.videos.length) {
          setBundledIndex(buildVideoIndex(data.videos));
        }
        if (Array.isArray(data.audios)) setBundledAudios(data.audios);
        if (Array.isArray(data.audios) && data.audios.length > 0) {
          setBundledAudioIdx(Math.floor(Math.random() * data.audios.length));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // 加载钢琴视频清单（播放态视频源）
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (const url of [PIANO_MANIFEST_URL, PIANO_MANIFEST_FALLBACK]) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled) return;
          if (Array.isArray(data.videos) && data.videos.length) {
            setPianoUrls(data.videos);
            return;
          }
        } catch {}
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (activeSource?.type === "file" && activeSource.url) {
      setLocalTracks([{ name: activeSource.name || "Wallpaper Ambience", url: activeSource.url }]);
      setLocalTrackIdx(0);
      setTrackName(activeSource.name || "");
      return () => { cancelled = true; };
    }
    if (!isRadio && activeSource.dirKey) {
      (async () => {
        try {
          const handle = await getHandle(activeSource.dirKey);
          if (cancelled || !handle) return;
          const perm = await queryPermission(handle);
          if (cancelled || perm !== "granted") return;
          const tracks = await listAudioFromDir(handle);
          if (cancelled) { revokeAll(tracks); return; }
          revokeAll(localUrlsRef.current);
          localUrlsRef.current = tracks;
          setLocalTracks(tracks);
          setLocalTrackIdx(0);
          setTrackName(tracks[0]?.name || "");
        } catch {}
      })();
    } else {
      revokeAll(localUrlsRef.current);
      localUrlsRef.current = [];
      setLocalTracks([]);
      setLocalTrackIdx(0);
    }
    return () => { cancelled = true; };
  }, [isRadio, activeSource.dirKey, activeSource.type, activeSource.url, activeSource.name]);

  const pickLoopVideo = useCallback((state, period) => {
    const idx = videoIndexRef.current;
    if (!idx) return null;
    if (idx.loops?.[state]?.[period]) return idx.loops[state][period];
    for (const s of STATES) {
      if (idx.loops?.[s]?.[period]) return idx.loops[s][period];
    }
    const generic = idx.loops?.generic;
    if (generic) {
      const keys = Object.keys(generic);
      if (keys.length > 0) return generic[keys[Math.floor(Math.random() * keys.length)]];
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applyBundled = () => {
      if (cancelled) return;
      if (bundledIndex) {
        videoIndexRef.current = bundledIndex;
        setHasVideoIndex(true);
        setVideoPhase("loop");
        setVideoSrc(pickLoopVideo(currentStateRef.current, getTimePeriod())?.url || null);
      } else {
        videoIndexRef.current = null;
        setHasVideoIndex(false);
        setVideoSrc(null);
      }
    };
    const loadVideos = async () => {
      try {
        const handle = await getHandle(SONG_VIDEO_DIR_KEY);
        if (cancelled) return;
        if (handle) {
          const perm = await queryPermission(handle);
          if (cancelled || perm !== "granted") { applyBundled(); return; }
          const videos = await listVideosFromDir(handle);
          if (cancelled) { revokeAll(videos); return; }
          revokeAll(videoUrlsRef.current);
          videoUrlsRef.current = videos;
          if (videos.length > 0) {
            videoIndexRef.current = buildVideoIndex(videos);
            setHasVideoIndex(true);
            setVideoPhase("loop");
            setVideoSrc(pickLoopVideo(currentStateRef.current, getTimePeriod())?.url || null);
            return;
          }
        }
        applyBundled();
      } catch {
        applyBundled();
      }
    };
    loadVideos();
    const cleanup = onVideoReload(loadVideos);
    return () => { cancelled = true; cleanup(); };
  }, [pickLoopVideo, bundledIndex]);

  useEffect(() => {
    const updateVideo = () => {
      const idx = videoIndexRef.current;
      if (!idx) return; // 清单/目录未就绪，等待加载逻辑接管
      const period = getTimePeriod();
      const prevPeriod = currentPeriodRef.current;
      const state = currentStateRef.current;

      if (period !== prevPeriod) {
        currentPeriodRef.current = period;
        const transKey = `${prevPeriod}_${period}`;
        let transVideo = null;
        for (const s of STATES) {
          if (idx?.transitions?.[s]?.[transKey]) {
            transVideo = idx.transitions[s][transKey];
            break;
          }
        }
        if (transVideo) {
          setVideoPhase("transition");
          setVideoSrc(transVideo.url);
        } else {
          setVideoPhase("loop");
          setVideoSrc(pickLoopVideo(state, period)?.url || null);
        }
      } else if (!videoSrc) {
        setVideoPhase("loop");
        setVideoSrc(pickLoopVideo(state, period)?.url || null);
      }
    };

    updateVideo();
    const id = setInterval(updateVideo, 60000);
    return () => clearInterval(id);
  }, [pickLoopVideo, videoSrc]);

  const handleVideoEnded = useCallback(() => {
    const idx = videoIndexRef.current;
    if (!idx) return;
    const period = currentPeriodRef.current;
    setVideoKey((k) => k + 1);

    if (videoPhase === "transition") {
      const newState = pickRandom(STATES);
      currentStateRef.current = newState;
      setVideoPhase("loop");
      setVideoSrc(pickLoopVideo(newState, period)?.url || null);
    } else {
      const newPeriod = getTimePeriod();
      if (newPeriod !== period) {
        currentPeriodRef.current = newPeriod;
        const transKey = `${period}_${newPeriod}`;
        let transVideo = null;
        for (const s of STATES) {
          if (idx.transitions?.[s]?.[transKey]) {
            transVideo = idx.transitions[s][transKey];
            break;
          }
        }
        if (transVideo) {
          setVideoPhase("transition");
          setVideoSrc(transVideo.url);
        } else {
          const newState = pickRandom(STATES);
          currentStateRef.current = newState;
          setVideoPhase("loop");
          setVideoSrc(pickLoopVideo(newState, newPeriod)?.url || null);
        }
      } else {
        const newState = pickRandom(STATES);
        currentStateRef.current = newState;
        setVideoPhase("loop");
        setVideoSrc(pickLoopVideo(newState, period)?.url || null);
      }
    }
  }, [videoPhase, pickLoopVideo]);

  const currentStreamUrl = isRadio
    ? (activeSource.streamUrl || "")
    : (localTracks[localTrackIdx]?.url || "");

  // 待机音频：仅待机模式（暂停）播放；钢琴视频模式暂停之。音量仍由 Settings 的 volume 决定。
  useEffect(() => {
    if (!audioRef.current || !currentStreamUrl) return;
    const audio = audioRef.current;
    if (audio.src !== currentStreamUrl) {
      audio.src = currentStreamUrl;
      audio.load();
    }
    if (!isPlaying) {
      if (audio.paused) audio.play().catch(() => {});
    } else {
      if (!audio.paused) audio.pause();
    }
    if (!isRadio) setTrackName(localTracks[localTrackIdx]?.name || "");
  }, [currentStreamUrl, isRadio, isPlaying]);

  // 音量：实际音量取自 Settings(volume)；滑块改为静音待机音频。
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, Number(volume) / 100));
      audioRef.current.muted = standbyMuted;
    }
  }, [volume, standbyMuted]);

  // 选一段钢琴视频：先随机选曲（尽量不连续重复），再按当前时段(1200/1730/2000)选对应版本
  // 兼容两种 manifest 格式：
  //   新格式 { name, periods:{"1200":{url,size},...} }
  //   旧格式 { name, url, size }（无时段拆分，整曲兜底）
  const pickPiano = useCallback(() => {
    if (pianoUrls.length === 0) { setPianoUrl(null); return; }
    let idx = Math.floor(Math.random() * pianoUrls.length);
    if (pianoUrls.length > 1 && pianoUrls[idx]?.name === pianoName) {
      idx = (idx + 1) % pianoUrls.length;
    }
    const song = pianoUrls[idx] || {};
    const period = getTimePeriod();
    const variant =
      song.periods?.[period] ||
      song.periods?.["1200"] ||
      (song.url ? { url: song.url } : null);
    setPianoUrl(variant?.url || null);
    setPianoName(song.name || "钢琴演奏");
    setPianoKey((k) => k + 1);
  }, [pianoUrls, pianoName]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false); // → 待机（本地动画 + 待机音频）
    } else {
      pickPiano(); // 随机一段钢琴视频
      setIsPlaying(true); // → 钢琴视频模式
    }
  };

  const handlePianoEnded = () => { if (isPlaying) pickPiano(); };

  // 待机音频：单曲结束自动接下一首（不切换 isPlaying 状态）
  const handleAudioEnded = () => {
    if (isRadio) return;
    const playNext = (url) => {
      const a = audioRef.current;
      if (!a || !url) return;
      if (a.src !== url) { a.src = url; a.load(); }
      a.play().catch(() => {});
    };
    if (activeSource?.bundled && bundledAudios.length > 0) {
      const nextIdx = (bundledAudioIdx + 1) % bundledAudios.length;
      setBundledAudioIdx(nextIdx);
      playNext(bundledAudios[nextIdx]?.url || "");
      return;
    }
    if (localTracks.length > 0) {
      const nextIdx = (localTrackIdx + 1) % localTracks.length;
      setLocalTrackIdx(nextIdx);
      playNext(localTracks[nextIdx]?.url || "");
    }
  };

  const changeSource = (newIndex) => {
    setSourceIndex(newIndex);
    setLocalTrackIdx(0);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsBuffering(false);
    }
  };

  const goNext = () => {
    if (isPlaying) { pickPiano(); return; }
    if (isRadio || activeSource.type === "file") {
      changeSource((sourceIndex + 1) % effectiveSources.length);
    } else {
      setLocalTrackIdx((i) => (i + 1) % localTracks.length);
    }
  };

  const goPrev = () => {
    if (isPlaying) { pickPiano(); return; }
    if (isRadio || activeSource.type === "file") {
      changeSource((sourceIndex - 1 + effectiveSources.length) % effectiveSources.length);
    } else {
      setLocalTrackIdx((i) => (i - 1 + localTracks.length) % localTracks.length);
    }
  };

  const toggleMute = () => setStandbyMuted((m) => !m);

  // 标题：播放中显示视频名，待机仍是「Bside Olivia Lin」；状态位：待机显示「休息中」
  const displayName = isPlaying ? (pianoName || "钢琴演奏") : "Bside Olivia Lin";

  const statusLabel = isPlaying ? "播放中" : "休息中";

  return (
    <div className={`${WIDGET_SHELL} song-widget`}>
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={handleAudioEnded}
        onError={() => { setIsBuffering(false); }}
      />

      <div className={WIDGET_HEADER}>
        <div className={`${HEADER_TITLE} pr-2`} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>{displayName}</span>
        </div>

        <div
          className="song-rest-badge opacity-70 flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 hover:border-white/30 hover:opacity-85 transition-colors shrink-0 shadow-sm"
        >
          <span
            className={`song-rest-dot w-2.5 h-2.5 rounded-full border border-white/60 transition-all ${
              isPlaying ? "animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-50"
            }`}
          />
          <span className="text-[10.5px] font-gilroy-bold tracking-wide uppercase song-rest-label">
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 flex items-stretch gap-3 z-10 relative overflow-hidden">
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden relative border border-white/15 bg-black/70 shadow-xl flex items-center justify-center group">
          {isPlaying ? (
            pianoUrl ? (
              <video
                key={pianoKey}
                ref={pianoVideoRef}
                src={pianoUrl}
                autoPlay
                muted={standbyMuted}
                playsInline
                onEnded={handlePianoEnded}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-full bg-black/70 flex items-center justify-center">
                <p className="text-white/60 text-xs font-gilroy-medium">正在加载钢琴视频…</p>
              </div>
            )
          ) : videoSrc ? (
            <video
              key={videoKey}
              ref={videoRef}
              src={videoSrc}
              autoPlay
              muted
              playsInline
              loop={!hasVideoIndex}
              onEnded={handleVideoEnded}
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/60 via-cyan-950/50 to-slate-900/70 flex flex-col items-center justify-center p-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
              <div className="flex items-end justify-center gap-1.5 mb-2.5 h-10 z-10">
                {[0, 100, 200, 75, 150].map((delay, i) => (
                  <span
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      ["bg-purple-300", "bg-indigo-300", "bg-pink-300", "bg-cyan-300", "bg-purple-300"][i]
                    } ${isPlaying ? `animate-pulse h-${[9,7,10,6,8][i]}` : "h-3 opacity-40"}`}
                    style={isPlaying ? { animationDelay: `${delay}ms` } : undefined}
                  />
                ))}
              </div>
              <div className="z-10 text-center px-2 max-w-full">
                <p className="text-white text-xs font-gilroy-bold truncate drop-shadow-md">{displayName}</p>
                <p className="text-white/50 text-[10px] font-gilroy-medium mt-0.5">
                  {isBuffering ? "正在连接…" : isPlaying ? "正在播放" : "点击播放"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-2.5 shrink-0">
          <button type="button" onClick={goPrev}
            className="song-ctrl-btn h-8 w-8 rounded-full border border-white/15 hover:border-white/30 flex items-center justify-center opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            title="上一个 / 换一页">
            <i className="ri-skip-back-fill text-xs relative z-10"></i>
          </button>

          <button type="button" onClick={togglePlay}
            className="song-ctrl-btn h-11 w-11 rounded-full border border-white/15 hover:border-white/30 flex items-center justify-center opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-md"
            title={isPlaying ? "暂停（恢复待机）" : "播放钢琴视频"}>
            {isBuffering
              ? <i className="ri-loader-4-line text-lg animate-spin relative z-10" />
              : <i className={`${isPlaying ? "ri-pause-fill" : "ri-play-fill ml-0.5"} text-lg relative z-10`} />}
          </button>

          <button type="button" onClick={goNext}
            className="song-ctrl-btn h-8 w-8 rounded-full border border-white/15 hover:border-white/30 flex items-center justify-center opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            title="下一个 / 换一页">
            <i className="ri-skip-forward-fill text-xs relative z-10"></i>
          </button>

          <div className="relative flex items-center">
            <button type="button" onClick={toggleMute}
              className="song-ctrl-btn h-8 w-8 rounded-full border border-white/15 hover:border-white/30 flex items-center justify-center opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
              title={standbyMuted ? "取消静音待机音频" : "静音待机音频"}>
              <i className={`${standbyMuted ? "ri-volume-mute-line" : "ri-volume-up-line"} text-sm relative z-10`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongPlayer;
