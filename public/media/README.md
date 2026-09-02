# 插件素材目录（打包进扩展，零配置可用）

本目录下的所有文件会被 Vite 原样拷贝到扩展根，新电脑安装后无需任何额外准备即可使用。

## 目录结构

```
public/
├── fonts/          # 字体（已在 index.css / legacy.css 中以 /fonts/... 引用）
├── images/         # 主题壁纸 + 扩展图标
│   ├── default-wallpaper.jpg
│   ├── liquid-glass-wallpaper.jpg
│   └── logo.png
└── media/          # 媒体素材
    ├── video/      # Wallpaper_Presence 背景视频（多状态）
    ├── audio/      # Wallpaper_Ambience 背景音乐（循环）
    ├── carousel/   # 图片轮播组件默认加载图
    ├── manifest.json        # 由 gen_media_manifest 生成：视频/音频清单
    └── carousel/manifest.json
```

## 命名规范

### 视频（Wallpaper_Presence）— `video/`
代码按文件名解析状态/时段，命名不可随意改动（解析规则见 `src/utils/fsAccess.js` 的 `parseVideoFilename`）：

- 循环片段：`{State}_R1_{Timecode}.mp4`
  - `State` ∈ `A` / `B` / `C`
  - `Timecode` ∈ `1200`(白天 7–17) / `1730`(黄昏 17–20) / `2000`(夜晚 20–7)
  - 例：`A_R1_1200.mp4`
- 转场片段：`{State}_Transition_{from}_{to}.mp4`
  - 例：`A_Transition_1200_1730.mp4`

### 音频（Wallpaper_Ambience）— `audio/`
- `ambient_loop_{N}.mp3`（`N` 为序号，按数字排序后轮换播放）
- 例：`ambient_loop_1.mp3` … `ambient_loop_22.mp3`

### 轮播默认图 — `carousel/`
- 任意图片格式（jpg/png/webp…），加入后由 `carousel/manifest.json` 自动列出。

## 重新生成清单

新增/替换媒体文件后，运行（项目根目录）：

```bash
node gen_media_manifest.cjs
```

会刷新 `media/manifest.json` 与 `media/carousel/manifest.json`。
