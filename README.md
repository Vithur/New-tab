# New tab · 一体化新标签页工作台

一个替代浏览器新标签页的 Chrome / Edge 扩展：把时钟、天气、待办、RSS、日历、音乐与常用网站聚合进一个可拖拽布局的工作台。

## 功能特性

- **新标签页接管**：`chrome_url_overrides.newtab`，打开新标签即进入工作台
- **可拖拽网格布局**：基于 `@dnd-kit`，组件自由摆放、缩放、编辑
- **主题系统**：暗色玻璃 / 亮色玻璃，并支持**跟随系统**浅色 / 深色（`matchMedia` 实时切换）
- **自定义壁纸**：拖放图片或链接设置背景
- **音乐与钢琴视频**：背景音乐 + 播放态钢琴演奏视频（片源走独立媒体仓库，运行时拉取，见下）
- **多组件**：待办 / RSS / 日历 / 常用网站分组
- **内置默认数据**：一键「恢复内置默认数据」，只写回种子字段，**不丢**个人配置（HA / 音乐目录 / 壁纸）

## 技术栈

React 18 · Vite 5 · Tailwind CSS · Chrome Manifest V3

## 目录结构

```
src/
  App.jsx                  根组件、状态与 hydration
  components/
    DashboardGrid.jsx      网格布局
    SettingsPage.jsx       设置页（主题 / 壁纸 / 音乐 / 备份…）
    SongPlayer.jsx         音乐与钢琴视频播放器
    Todo.jsx               待办
    ...
  data/default-layout.json 插件默认数据（种子）
  themes/                  主题配色
public/
  media/                   内置媒体（含 piano_manifest.json 兜底）
  images/                  图标
manifest.json
```

## 开发

```bash
npm install
npm run dev      # Vite 开发服务器
npm run build    # 产物输出到 dist/（可直接打包 / 加载）
```

## 安装（给用户）

> 不花 $5 注册 Chrome 开发者账号的两种免费分发方式，详见 [docs/distribution.md](docs/distribution.md)。

### 方式一：GitHub Releases 加载已解压包（推荐，零成本）

1. 到本仓库 **Releases** 下载最新的 `new-tab-vX.X.X.zip` 并解压到一个**固定目录**；
2. 打开 `chrome://extensions`，右上角开启**开发者模式**；
3. 点击**加载已解压的扩展程序**，选择解压后的 `dist`（或 `new-tab`）文件夹；
4. 将本扩展设为新标签页（部分浏览器需在扩展管理里允许「替换新标签页」）。

更新：重新下载新版 zip → 回到 `chrome://extensions` 点该扩展卡片上的**刷新**图标即可。

### 方式二：自托管 CRX + 自动更新（适合长期分发给多人）

1. 用**固定私钥**打包出 `.crx`（保留 `.pem`，否则扩展 ID 会变、更新链断裂）；
2. 在 `manifest.json` 加入 `"update_url": "https://你的域名/updates.xml"`；
3. 托管 `updates.xml`（AUM 格式）+ `.crx`，二者均须 **HTTPS**；
4. 用户首次**拖入 `.crx` 安装**（需开发者模式）后，之后由 Chrome 周期**静默自动更新**。

仓库已附模板 [`update/updates.xml`](update/updates.xml)（占位 `appid` / 域名 / `version`）。HTTPS 可用个人域名 + Cloudflare Tunnel 或 fnOS 反代 + Let's Encrypt 实现。完整步骤见 [docs/distribution.md](docs/distribution.md)。

## 媒体资源（钢琴视频）

钢琴片源**不在本仓库**，而在独立媒体仓库 [`Vithur/Project-OS-Media`](https://github.com/Vithur/Project-OS-Media)，由 `SongPlayer.jsx` 在运行时通过 `piano_manifest.json` 拉取（CDN + 本地兜底）。

**继续往 piano 文件夹加片源，插件代码不用改。** 只需：

1. 把 mp4 上传到媒体仓库 `media/piano/`；
2. 在 `piano_manifest.json` 的 `videos` 数组加一条：

```json
{
  "name": "你的曲名",
  "periods": {
    "1200": { "url": "https://cdn.jsdelivr.net/gh/Vithur/Project-OS-Media@main/media/piano/你的曲名_1200.mp4", "size": 0 },
    "1730": { "url": "..._1730.mp4", "size": 0 },
    "2000": { "url": "..._2000.mp4", "size": 0 }
  }
}
```

`periods` 是三档码率变体；若只有一份文件，三档填同一个 URL 即可（`size` 填实际字节数或不填）。jsDelivr 有边缘缓存，推送后稍等刷新或主动 purge 即可生效。

## 许可证

MIT
