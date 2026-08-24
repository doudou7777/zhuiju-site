# 追剧自由 · 资源导航站

基于开源项目 [laoma2053/awesome-zhuiju-free](https://github.com/laoma2053/awesome-zhuiju-free)（CC BY 4.0）搭建的独立追剧资源导航网站：

- 🎨 **更友好的界面**：搜索、分类筛选、可用状态徽章、推荐指数、风险标签、深浅色模式、移动端适配
- 🔄 **自动同步**：GitHub Actions 每 6 小时自动拉取上游最新数据；网页上点「刷新数据」可立即获取最新数据，全程不用打开 GitHub
- 🚀 **部署到 Cloudflare Pages**：免费、全球 CDN、国内相对可用

## 目录结构

```
.
├── site/                     # 静态网站（部署输出目录）
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data.json             # 由同步脚本生成（已合并可用性检测结果）
├── functions/api/data.js     # Cloudflare Pages Function：/api/data 即时刷新代理
├── scripts/sync.mjs          # 同步脚本：拉取上游 JSON → 合并 → 写入 site/data.json
├── .github/workflows/sync.yml# GitHub Actions 定时自动同步
└── package.json
```

## 一、本地预览

需要 Node.js 18+：

```bash
npm run sync    # 拉取上游最新数据并生成 site/data.json
npm run serve   # 启动本地静态服务 http://localhost:8080
```

## 二、部署到 Cloudflare Pages（免费）

### 1. 创建你的 GitHub 仓库

1. 在 GitHub 新建一个仓库（例如 `zhuiju-site`，公开或私有均可）
2. 把本项目所有文件推送上去：

```bash
git init
git add .
git commit -m "init: 追剧自由导航站"
git branch -M main
git remote add origin https://github.com/<你的用户名>/zhuiju-site.git
git push -u origin main
```

### 2. 连接 Cloudflare Pages

1. 注册/登录 [dash.cloudflare.com](https://dash.cloudflare.com)，进入 **Workers & Pages → Create → Pages → Connect to Git**
2. 授权 GitHub，选择刚创建的 `zhuiju-site` 仓库
3. 构建配置：
   - **Framework preset**：None
   - **Build command**：`npm run build`
   - **Build output directory**：`site`
4. 点击 **Save and Deploy**，等待几分钟，即可通过 `https://<项目名>.pages.dev` 访问 🎉

> 部署后每次你推送代码、或 GitHub Actions 自动同步提交了新的 `data.json`，Cloudflare 都会自动重新构建发布。

### 3. 自动同步是怎么工作的

| 机制 | 说明 |
|---|---|
| GitHub Actions 定时同步 | 每 6 小时（可用 `workflow_dispatch` 手动触发）拉取上游数据 → 更新 `site/data.json` → 提交推送 → Cloudflare 自动重新部署 |
| 网页「刷新数据」按钮 | 直接请求本站 `/api/data`（Cloudflare Function 代理上游），秒级拿到最新数据并重新渲染，**不需要等重新部署** |
| 容错 | 上游拉取失败时保留上次成功数据，网站不会白屏 |

### 4.（可选）绑定自定义域名

在 Cloudflare Pages 项目 **Custom domains** 里添加你的域名，按提示在 DNS 处添加 CNAME 记录指向 `<项目名>.pages.dev` 即可。

## 三、进阶配置

### 修改上游数据源（例如自建 fork）

同步脚本和 Function 默认从 `laoma2053/awesome-zhuiju-free` 拉取。如需改为其他仓库：

- GitHub Actions：在 `sync.yml` 的 `npm run sync` 步骤前加 `env:`，或直接改 `scripts/sync.mjs` 顶部的常量
- 网页刷新：修改 `site/app.js` 和 `functions/api/data.js` 顶部的 `UPSTREAM_REPO`

### 调整同步频率

修改 `.github/workflows/sync.yml` 中的 `cron` 表达式即可（GitHub 免费版最短每 5 分钟一次，建议 1~6 小时）。

## 四、免责声明

本站仅提供资源索引与可用性提示，不托管任何影视文件、破解软件、账号或密钥。访问第三方站点前请遵守所在地法律与服务条款，自行判断风险。数据版权归上游项目所有（CC BY 4.0）。

## 五、致谢

- 数据与检测机制：[laoma2053/awesome-zhuiju-free](https://github.com/laoma2053/awesome-zhuiju-free)
