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

const SongPlayer = ({
  dragHandleProps,
  musicSources = [],
  autoPlay,
  volume = 80,
  onVolumeChange,
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(Boolean(autoPlay));
  const [isBuffering, setIsBuffering] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
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
        // manifest 加载完毕：默认尝试自动播放 bundled 第一首（chrome autoplay 策略下若失败也无害）
        if (Array.isArray(data.audios) && data.audios.length > 0) {
          setBundledAudioIdx(0);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // 默认音乐自动播放：bundled 清单加载完后，若 autoPlay=true 且用户尚未交互，主动触发一次。
  // 用户主动 togglePlay 后，isPlaying 已被用户掌握，此 effect 不会再覆盖。
  // 关键：autoPlay 关闭时（无论音频是否因默认 true 已开播），都主动暂停——避免
  // "默认 true → 音频已播 → 用户关闭 → 音频继续放"的回归。
  const hasUserInteractedRef = useRef(false);
  useEffect(() => {
    if (hasUserInteractedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (!autoPlay) {
      // 关闭自动播放：把仍在自动启动的音频停掉。
      if (!audio.paused || isPlaying) {
        audio.pause();
        setIsPlaying(false);
        setIsBuffering(false);
      }
      return;
    }
    if (bundledAudios.length === 0) return;
    // 只在没有任何"用户添加的源"且我们仍在 bundled 上时启动
    if (Array.isArray(musicSources) && musicSources.length > 0) return;
    const firstUrl = bundledAudios[0]?.url;
    if (!firstUrl) return;
    if (audio.src === firstUrl && !audio.paused) return;
    audio.src = firstUrl;
    audio.load();
    setIsPlaying(true);
    setIsBuffering(true);
    audio.play()
      .then(() => setIsBuffering(false))
      .catch(() => { setIsBuffering(false); setIsPlaying(false); });
  }, [bundledAudios, autoPlay, musicSources]);

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

  useEffect(() => {
    if (!audioRef.current || !currentStreamUrl) return;
    const audio = audioRef.current;
    // 仅在 src 真正变化时才重新 load，避免续播时（URL 可能相同）被打断重头播放
    if (audio.src !== currentStreamUrl) {
      audio.src = currentStreamUrl;
      audio.load();
    }
    if (isPlaying) {
      if (audio.paused) {
        setIsBuffering(true);
        audio.play()
          .then(() => setIsBuffering(false))
          .catch(() => setIsBuffering(false));
      }
    } else {
      audio.pause();
      setIsBuffering(false);
    }
    if (!isRadio) {
      setTrackName(localTracks[localTrackIdx]?.name || "");
    }
  }, [currentStreamUrl, isRadio, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, Number(volume) / 100));
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    hasUserInteractedRef.current = true;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    } else {
      setIsBuffering(true);
      if (!audio.src || audio.src !== currentStreamUrl) {
        audio.src = currentStreamUrl;
        audio.load();
      }
      audio.play()
        .then(() => { setIsBuffering(false); setIsPlaying(true); })
        .catch(() => { setIsBuffering(false); setIsPlaying(false); });
    }
  };

  // 直接续播指定 URL（不依赖播放 effect），保证单曲结束/回绕也能无缝接上下一首
  const playUrl = (url, name) => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    setIsPlaying(true);
    setIsBuffering(true);
    audio.play()
      .then(() => setIsBuffering(false))
      .catch(() => setIsBuffering(false));
    if (name) setTrackName(name);
  };

  // 用户主动操作（删除/切换源）后再启动下一首，确保切源后也能自动续播
  const startPlayback = useCallback(() => {
    if (bundledAudios.length === 0) return;
    const firstUrl = bundledAudios[bundledAudioIdx]?.url;
    if (!firstUrl) return;
    playUrl(firstUrl, bundledAudios[bundledAudioIdx]?.name || "Wallpaper Ambience");
  }, [bundledAudios, bundledAudioIdx]);

  const handleAudioEnded = () => {
    if (isRadio) return;
    if (activeSource?.bundled && bundledAudios.length > 0) {
      const nextIdx = (bundledAudioIdx + 1) % bundledAudios.length;
      setBundledAudioIdx(nextIdx);
      const next = bundledAudios[nextIdx];
      playUrl(next?.url || "", next?.name || "Wallpaper Ambience");
      return;
    }
    if (localTracks.length > 0) {
      const nextIdx = (localTrackIdx + 1) % localTracks.length;
      setLocalTrackIdx(nextIdx);
      const next = localTracks[nextIdx];
      playUrl(next?.url || "", next?.name || "");
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
    if (isRadio || activeSource.type === "file") {
      changeSource((sourceIndex + 1) % effectiveSources.length);
    } else {
      setLocalTrackIdx((i) => (i + 1) % localTracks.length);
    }
  };

  const goPrev = () => {
    if (isRadio || activeSource.type === "file") {
      changeSource((sourceIndex - 1 + effectiveSources.length) % effectiveSources.length);
    } else {
      setLocalTrackIdx((i) => (i - 1 + localTracks.length) % localTracks.length);
    }
  };

  const handleVolumeChange = (e) => {
    const next = Number(e.target.value);
    if (onVolumeChange) onVolumeChange(next);
    if (audioRef.current) audioRef.current.volume = next / 100;
  };

  const displayName = isRadio
    ? activeSource.name
    : (trackName || activeSource.name || "本地音乐");

  const statusLabel = isBuffering
    ? "缓冲中"
    : isPlaying
      ? (isRadio ? "直播" : "播放中")
      : "已暂停";

  return (
    <div className={`${WIDGET_SHELL} song-widget`}>
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={handleAudioEnded}
        onError={() => { setIsBuffering(false); setIsPlaying(false); }}
      />

      <div className={WIDGET_HEADER}>
        <div className={`${HEADER_TITLE} pr-2`} data-drag-handle {...dragHandleProps}>
          <i className={HEADER_DRAG_ICON}></i>
          <span className={HEADER_LABEL}>{displayName}</span>
        </div>

        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-transparent hover:border-white/30 text-white opacity-45 hover:opacity-80 transition-all duration-300 shrink-0 shadow-sm"
          style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full border border-white/60 transition-all ${
              isPlaying ? "animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-40"
            }`}
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }}
          />
          <span className="text-[10.5px] font-gilroy-bold text-white tracking-wide uppercase">
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 flex items-stretch gap-3 z-10 relative overflow-hidden">
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden relative border border-white/15 bg-black/70 shadow-xl flex items-center justify-center group">
          {videoSrc ? (
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
            className="h-8 w-8 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }} title="上一个">
            <i className="ri-skip-back-fill text-xs relative z-10"></i>
          </button>

          <button type="button" onClick={togglePlay}
            className="h-11 w-11 rounded-full border border-transparent hover:border-white/40 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-md"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }} title={isPlaying ? "暂停" : "播放"}>
            {isBuffering
              ? <i className="ri-loader-4-line text-lg animate-spin text-white relative z-10" />
              : <i className={`${isPlaying ? "ri-pause-fill" : "ri-play-fill ml-0.5"} text-lg relative z-10`} />}
          </button>

          <button type="button" onClick={goNext}
            className="h-8 w-8 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
            style={{ backgroundColor: "var(--theme-4, #0F172A)" }} title="下一个">
            <i className="ri-skip-forward-fill text-xs relative z-10"></i>
          </button>

          <div className="relative flex items-center">
            {showVolume && (
              <div className="absolute right-full mr-2.5 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 shadow-xl flex items-center gap-2 z-20">
                <button type="button"
                  onClick={() => onVolumeChange && onVolumeChange(Number(volume) > 0 ? 0 : 80)}
                  className="text-white/70 hover:text-white cursor-pointer shrink-0"
                  title={Number(volume) > 0 ? "静音" : "恢复音量"}>
                  <i className={`${Number(volume) > 0 ? "ri-volume-up-line" : "ri-volume-mute-line"} text-sm`} />
                </button>
                <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange}
                  className="w-20 h-1 accent-[color:var(--theme)] cursor-pointer" title={`音量 ${volume}%`} />
                <span className="text-[10px] text-white/60 font-gilroy-bold w-6 text-right">{volume}</span>
              </div>
            )}
            <button type="button" onClick={() => setShowVolume((v) => !v)}
              className="h-8 w-8 rounded-full border border-transparent hover:border-white/30 flex items-center justify-center text-white opacity-45 hover:opacity-80 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
              style={{ backgroundColor: "var(--theme-4, #0F172A)" }} title="音量">
              <i className={`${Number(volume) > 0 ? "ri-volume-up-line" : "ri-volume-mute-line"} text-sm relative z-10`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongPlayer;
