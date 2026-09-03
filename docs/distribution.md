# 安装与分发指南（详细版）

> 本文件是 `README.md` 中「安装」章节的展开。不想花 $5 注册 Chrome 开发者账号时的三种分发方式，重点拆解**自托管 CRX 自动更新**。

---

## 一、三种分发方式对比

| 方式 | 费用 | 对方安装门槛 | 自动更新 | 你需要做的事 |
|---|---|---|---|---|
| **A. 开发者模式加载已解压**（GitHub Releases 发 zip） | 免费 | 中：开开发者模式→加载已解压 | ❌ 手动重拉 | 0 改动，打包 `dist` 即可 |
| **B. Edge 外接程序商店** | 免费（微软账号+实名，无 $5） | 最低：Edge 内一键装 | ✅ | 极小（本扩展只用 `chrome.storage`/`matchMedia`，Edge 全兼容） |
| **C. 自托管 CRX + updates.xml**（本文重点） | 免费（需一个域名+HTTPS） | 中：首次拖入 CRX，之后全自动 | ✅ | 打包固定密钥 + 加 `update_url` + 托管静态文件 |

> **关键现实**：Chrome 自 2018 年起禁止非商店扩展静默/自动**首装**，unpacked 也没有自动更新。
> 所以要「自动更新」→ 得上自托管 CRX 或免费商店（Edge）；要「零审核零花费」→ 只能 unpacked 手动更新。两者不可兼得，按需选。

---

## 二、安装方法（对方视角）

### 方式 A：开发者模式加载已解压（GitHub Releases，零成本）

1. 下载仓库 Releases 里的 `new-tab-vX.X.X.zip` 并解压到一个**固定目录**（如 `D:\ext\new-tab`，不要放桌面临时目录，否则路径变动会失效）。
2. 打开 `chrome://extensions`，右上角打开**「开发者模式」**。
3. 点击**「加载已解压的扩展程序」**，选择刚才解压的文件夹。
4. 在扩展列表里把「新标签页」固定，点开新标签页即可使用。
5. 更新时：重新下载新 zip → 覆盖原目录文件 → 回到 `chrome://extensions` 点该扩展的**刷新图标**（或重载扩展）。

> 缺点：Chrome 会显示「请停用开发者模式扩展」提示条（不影响使用）；每次更新需手动刷新。

### 方式 B：Edge 外接程序商店（免费、一键装、自动更新）

1. 注册 Microsoft 合作伙伴中心（个人免费，比 Chrome 的 $5 省），完成身份/税务信息。
2. 把本扩展提交到 Edge 外接程序商店（Chromium 内核，`chrome.storage`/`matchMedia` 全部兼容，几乎零改）。
3. 审核通过后，对方在 Edge 里点「获取」即装，后续自动更新。

> 适合「希望对方零门槛、又不想审核等太久」的场景。

### 方式 C：自托管 CRX + 自动更新（见第三节）

首次手动拖入 CRX 安装一次，之后 Chrome 自动静默更新。

---

## 三、自托管 CRX + updates.xml 详细方案

### 1. 工作原理

```
你的 Chrome 用户
   │  启动 / 每几小时
   ▼
读取已装扩展的 update_url ──HTTPS──▶ 你的 updates.xml
                                          │ 比对 version
                                          │ 若 XML 里 version > 已装版本
                                          ▼
                              下载 codebase 指向的 .crx（HTTPS）
                                          │
                                          ▼
                                  静默安装新版本 ✅
```

- 扩展的 `manifest.json` 里写 `"update_url": "https://你的域名/updates.xml"`。
- Chrome 周期性向该 URL 发更新检查请求，服务器返回 **AUM 格式**的 XML。
- XML 里声明当前最新 `version` 和 `.crx` 下载地址（`codebase`）。版本号更高则自动下载安装。

### 2. 前置条件

- 一个**公开可访问的 HTTPS 域名**（见第四节，用 NAS 反代 + Cloudflare/Let's Encrypt 实现）。
- 一个**固定的 RSA 私钥（.pem）**用于打包，保证扩展 ID 永远不变（ID 变了自动更新就断，用户得重装）。
- 服务器能把 `.crx` 以 `Content-Type: application/x-chrome-extension` 返回。

### 3. 打包（固定密钥，保证 ID 不变）

**方法一（推荐，最稳）：Chrome 界面打包**
1. 打开 `chrome://extensions` → 开发者模式 → 点击**「打包扩展程序」**。
2. 扩展根目录选本项目的 `dist` 文件夹。
3. **私钥文件**：第一次留空，Chrome 会生成一个 `dist.pem`；**务必永久保存这个 .pem**（丢了一切重来）。
4. 之后每次发版，都在「私钥文件」里选回这个 `dist.pem` → 生成的 `.crx` ID 恒定。
5. 打包完成后，Chrome 弹窗里会显示 **扩展 ID**（形如 `aapbccdefghijklmnopqrstuvwxyz0123`），记下来填进 `updates.xml`。

**方法二（CI/脚本）：node `crx` 包**
```bash
npm i -g crx
crx pack dist -o new-tab.crx -p dist.pem   # 复用同一把 .pem
```

### 4. 在 manifest 写入 update_url（打包前必须做）

编辑 `manifest.json`，在根级加一行（其余不动）：

```json
{
  "manifest_version": 3,
  "name": "New tab",
  "version": "1.0.0",
  "update_url": "https://ext.你的域名.com/updates.xml",
  ...
}
```

> 注意：`update_url` 是从**打包后的 .crx** 读取的，所以改完 manifest 再走第 3 步打包。

### 5. updates.xml 格式（AUM 协议）

把下面内容放到你的 Web 根目录 `/updates.xml`，`Content-Type` 设为 `application/xml`：

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='这里填第3步拿到的扩展ID'>
    <updatecheck
      codebase='https://ext.你的域名.com/new-tab.crx'
      version='1.0.0' />
  </app>
</gupdate>
```

- `appid` = 扩展 ID（第 3 步获取），**必须完全一致**。
- `codebase` = 新 `.crx` 的绝对 HTTPS 地址。
- `version` = 当前最新版本号，**每次发版都要改大**（如 `1.0.0` → `1.0.1`）。

仓库里已附模板：`update/updates.xml`，改 ID / 域名 / 版本即可用。

### 6. 托管（HTTPS，见第四节）

用 NAS 反代把 `https://ext.你的域名.com/` 指到存放 `updates.xml` 与 `new-tab.crx` 的目录。服务器需满足：

| 资源 | 路径 | Content-Type |
|---|---|---|
| 更新清单 | `/updates.xml` | `application/xml` |
| 扩展包 | `/new-tab.crx` | `application/x-chrome-extension` |

Nginx 示例：
```nginx
location = /updates.xml {
  default_type application/xml;
  root /var/www/ext;
}
location = /new-tab.crx {
  default_type application/x-chrome-extension;
  root /var/www/ext;
}
```

### 7. 发布新版本流程

1. 改代码 → `rm -rf dist && npx vite build`。
2. 改 `manifest.json` 的 `version` 为更大值。
3. 用**同一把 .pem** 重新打包 → 得到新的 `new-tab.crx`。
4. 把新 `.crx` 传到 NAS 静态目录，覆盖旧的。
5. 改 `updates.xml` 的 `version` 为同一新版本号。
6. 完成。已安装的用户会在下次 Chrome 检查更新时**自动静默升级**，无需任何操作。

### 8. 限制与坑

- **首次安装必须手动**：Chrome 不允许非商店扩展静默首装。用户需 `chrome://extensions` 开开发者模式 → 把 `.crx` 拖进去。之后才自动更新。
- **私钥 .pem 不能丢**：丢了 = ID 变 = 自动更新断 + 老用户无法平滑升级。
- **update_url 与 codebase 都必须 HTTPS**，且证书须为公开可信 CA（Cloudflare / Let's Encrypt 均可；自签不被 Chrome 接受）。
- **版本号只能升不能降**：回滚需发一个更高的版本号。
- 拖入 CRX 安装时 Chrome 会弹「开发者模式」提示条，属正常，扩展保持启用。

---

## 四、NAS 反代 + 个人域名实现 HTTPS

你已有 fnOS NAS（192.168.1.42），完全可以做。**核心思路**：拿一个公开域名 → 用 Cloudflare（或 Let's Encrypt）签发可信证书 → 反代到 NAS 上存放静态文件的目录。

### 方案 1：Cloudflare Tunnel（最推荐，免端口转发）

1. 注册 Cloudflare，把你的域名 NS 切到 Cloudflare（免费）。
2. 在 NAS 的 Docker 里跑 `cloudflared` 隧道，把子域 `ext.你的域名.com` 指到本地静态文件服务（一个 Nginx/Caddy/文件服务容器，或 fnOS 反代后端）。
3. Cloudflare 自动提供 **Universal SSL**（HTTPS），无需你管证书。
4. 好处：**不用在路由器开 80/443 端口**，NAS 不出公网 IP 也能用，且证书自动续期。

### 方案 2：fnOS 反代 + Let's Encrypt

1. 路由器把 80/443 端口转发到 NAS（或用 Cloudflare 仅做 DNS）。
2. fnOS 自带的反代（或装 Caddy/Nginx 容器）监听 443，启用 Let's Encrypt 自动签发。
3. 反代规则：`ext.你的域名.com` → 内部静态目录（存放 `updates.xml` + `new-tab.crx`）。

Caddy 反代示例（自动 HTTPS）：
```caddy
ext.你的域名.com {
  root * /srv/ext
  file_server
  header /new-tab.crx Content-Type application/x-chrome-extension
}
```

### 静态文件放哪

在 NAS 上建一个目录（如 `/vol1/1000/docker/ext-static/`），放 `updates.xml` 和 `new-tab.crx`，用上面的反代/文件服务暴露成 `https://ext.你的域名.com/`。容量需求极小（扩展几百 KB，可忽略）。

---

## 五、降低门槛的可选技巧

- **Windows 启动器**：做一个 `.bat`/快捷方式，用 `chrome.exe --load-extension="解压绝对路径"` 启动。对方解压一次后双击即用，不用每次进扩展页（首次仍需开发者模式授权一次）。
- **带截图的中文安装向导**：把「开开发者模式 → 加载已解压」做成 3 步图文（见方式 A），心理门槛立刻降下来。
- **扩展内「检查更新」入口**：跳转你托管新版本的页面，手动但省心（真正的静默更新仍依赖第三节机制）。

---

## 六、FAQ

**Q：自托管 CRX 真的能自动更新吗？**
能。只要 `update_url` + HTTPS 的 `updates.xml` 配好，且 `.crx` 用固定密钥打包（ID 不变），Chrome 会周期性静默升级。唯一手动环节是**首次安装**。

**Q：域名必须备案吗？**
国内家用宽带 80/443 常被封且需备案；用 **Cloudflare Tunnel** 方案可完全绕过（隧道不依赖你家公网端口），最省事。若用 fnOS 反代 + 端口转发，则按国内规则可能需要备案/改用非标端口 + Cloudflare 仅 DNS。

**Q：Edge 和 Chrome 的 ID 一样吗？**
不一样。Chrome CRX 的 ID 由打包密钥决定；Firefox（`browser_specific_settings.gecko.id`）是另一套。本指南的自动更新仅针对 Chrome 系（含 Edge 用 CRX 侧载时同理）。

**Q：丢了 .pem 怎么办？**
无法恢复原 ID。只能用新密钥重新打包，老用户需手动重装。所以 `.pem` 务必备份到 NAS/云盘多处。
