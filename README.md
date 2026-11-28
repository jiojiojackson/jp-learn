# 日语专注修行（jp-learn）

游戏化的日语学习专注与刷词修行工具：设定学习目标、沉浸式白噪音番茄钟、内置日语道场快刷与 60 秒百人斩、神社每日御神签与 24 种风物伴学灵图鉴、周常言灵讨伐与连胜护盾，让你每次打开都停不下来。

- 前端：`public/index.html`（单文件，零外部资源依赖，无构建步骤）
- 后端：`src/index.js`（Cloudflare Worker，提供 `/api/state`）
- 数据库：Cloudflare D1（表 `goals` / `days` / `kv`，首次访问时自动建表）
- 静态资源：Workers Static Assets（`wrangler.jsonc` 中的 `assets`）

## 部署步骤（GitHub 连接 Cloudflare，无需本地命令行）

### 1. 准备仓库
把本项目所有文件放在 GitHub 仓库根目录（`wrangler.jsonc`、`package.json`、`src/`、`public/` 必须在根目录）。

### 2. 在 Cloudflare 连接仓库
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com)，进入 **Workers & Pages**。
2. 点击 **Create application**，选择 **Import a repository**（连接 Git）。
3. 授权 GitHub，选择仓库 `jiojiojackson/jp-learn`，分支选 `main`。
4. 构建设置：
   - **Worker name**：`jp-learn`（必须与 `wrangler.jsonc` 里的 `name` 一致，否则构建会失败）
   - **Root directory**：`/`
   - **Build command**：留空
   - **Deploy command**：`npx wrangler deploy`
5. 点击 **Save and Deploy**。

### 3. D1 数据库（自动创建）
`wrangler.jsonc` 里的 D1 绑定没有写 `database_id`，首次部署时 Wrangler 会自动在你的账号下创建 D1 数据库并绑定到 `DB`（需要 wrangler ≥ 4.45，`package.json` 已指定）。表结构由 Worker 首次收到请求时自动创建，不需要执行迁移。

部署完成后可在 **Storage & Databases → D1** 看到新建的数据库。

> 如果部署日志提示 D1 创建失败，改用手动方式：
> 1. 在 **Storage & Databases → D1 SQL database** 点击 **Create database**，名称填 `jp-learn-db`，复制它的 **Database ID**。
> 2. 把 `wrangler.jsonc` 中的 `"d1_databases"` 改成：
>    ```jsonc
>    "d1_databases": [
>      { "binding": "DB", "database_name": "jp-learn-db", "database_id": "粘贴你的 Database ID" }
>    ]
>    ```
> 3. 提交并推送，Cloudflare 会自动重新部署。

### 4. 设置访问口令（强烈建议）
部署后的网址任何人都能打开，如果不设口令，别人也能读写你的数据。

1. 进入 **Workers & Pages → jp-learn → Settings → Variables and Secrets**。
2. 点击 **Add**，类型选 **Secret**，名称 `ACCESS_TOKEN`，值填你自己的口令。
3. 保存并部署。之后第一次打开页面会要求输入口令，口令保存在该浏览器本地，换设备需要重新输入。

> 必须用 **Secret** 类型。普通 Variable 会在下次 Git 部署时被 `wrangler.jsonc` 覆盖。

### 5. 打开网站
在 **Settings → Domains & Routes** 里能看到 `https://jp-learn.<你的子域>.workers.dev`，手机和电脑都能打开，数据通过 D1 同步。也可以绑定自己的域名。

之后每次 `git push` 到 `main`，Cloudflare 都会自动重新部署。

## 本地开发
```bash
npm install
npx wrangler dev        # 本地模拟 D1，访问 http://localhost:8787
```
本地需要设置口令时，在项目根目录新建 `.dev.vars`（已被 `.gitignore` 忽略）：
```
ACCESS_TOKEN=你的口令
```

## 核心玩法与上瘾机制（v2.0）

- **专注心流升级**：
  - 支持 **15 分轻快 / 25 分标准 / 45 分深度** 三档专注圆环（对应满环奖励 +10 / +20 / +40 分），多轮自动循环累计显示 `🍅 ×N`。
  - **零资源 WebAudio 环境白噪音**：纯本地音频合成「🌧️ 夜雨 / 🌊 海浪 / 🔥 围炉」，一键静心。
  - **伴学灵互动 & 每日日语金句**：装备收集到的风物伴学灵陪读鼓励，内置日语谚语/名言卡片并支持 `ja-JP` 原生语音朗读。
  - **实时连击倒计时条 & 飘字反馈**：2 分钟内连续完成项目显示实时衰减热度条、连击加分与暴击飘字，另有快捷目标模板一键开刷。
- **言灵道场（互动刷词与百人斩）**：
  - 内置 **120+ 高频日语词条**（入门日常 / N5–N4 / N3 / N2–N1 难读词与拟态词 / 地道惯用句），自动混合「读音挑战、释义挑战、汉译日挑战」，支持键盘 `1-4` 秒选与 `R` 键发音。
  - **自在快刷** 与 **60 秒百人斩** 双模式（5 连击奖 +3 秒，冲击历史最高斩数）。
  - **错题自动收录 & 自建生词本**：答错自动入池，连续答对 3 次自动毕业斩除；支持随时录入课本生词生成专属题库。
- **神社祈愿与授与所**：
  - **每日免费御神签**：抽取 `大吉 / 中吉 / 小吉 / 吉` 今日专属修行加持 Buff（暴击率翻倍、专注加分、道场加分、连击上限提升）与幸运词。
  - **24 种日本风物与伴学灵图鉴（R / SR / SSR / UR）**：使用修行获得的「🪙 小判」单抽或五连保底祈愿，集齐解锁永久小判加成，任意藏品可设为专注伴学灵。
  - **身代护符（连胜护盾）& 狂热绘马**：漏打卡自动消耗护符冻结守护连续火焰；开启 30 分钟双倍狂热让目标与刷词得分 +50%。
- **周常言灵讨伐 & 36 枚四档成就**：
  - 每周刷新讨伐 BOSS，专注、完成目标、道场刷词均可造成伤害，击破阶数赢取丰厚积分与小判大礼。
  - 新增数据全部存放在原有的 `flags` 字段中，旧数据库表结构与历史成就 100% 无缝兼容。

## 常见问题
- **页面提示“无法连接服务器”**：检查 Worker 是否部署成功，以及 D1 是否已绑定（Settings → Bindings 中应有 `DB`）。
- **一直弹出口令输入框**：口令与 `ACCESS_TOKEN` 不一致；删除该 Secret 即可关闭口令保护。
- **构建失败提示 Worker 名称不匹配**：把控制台里的 Worker 名称改成 `jp-learn`，或同步修改 `wrangler.jsonc` 的 `name`。
