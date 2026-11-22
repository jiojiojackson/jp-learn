# 日语专注修行（jp-learn）

游戏化的日语学习专注力工具：设定学习目标和项目数，完成一项点一下加进度；底部按钮开始 / 暂停计时；结束后给出专注度统计；积分、等级、每日排行榜和成就持续激励你。

- 前端：`public/index.html`（单文件，无构建步骤）
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

## 数据与同步说明
- 计时、积分、排行榜、成就都存在 D1 中，多设备共享。
- 页面每次操作后约 0.8 秒自动同步；计时进行中每分钟同步一次；切回页面时会拉取最新数据。
- 多设备同时修改时使用版本号检测：旧版本的设备提交会被拒绝并自动载入最新数据，避免互相覆盖。
- 开始计时后关闭页面，计时仍会继续累计，学完请点「结束」。
- 备份数据：`npx wrangler d1 export <数据库名> --remote --output backup.sql`（数据库名见 D1 页面）。
- D1 免费额度对个人使用绰绰有余。

## 积分规则
| 行为 | 积分 |
| --- | --- |
| 完成一个项目 | +10 |
| 每专注 1 分钟 | +1 |
| 连续专注 25 分钟不暂停 | +20 |
| 完成整个目标 | +50 |
| 解锁成就 | +30 |

专注度 = 专注时间 ÷（专注时间 + 暂停时间）。

## 上瘾机制（v1.1）

- **28 个成就，分铜 / 银 / 金 / 钻四档**：奖励 20 / 40 / 80 / 150 分；未解锁的成就显示进度条，随时知道离下一个还有多远。
- **每日任务**：每天按日期固定抽 3 个，每个 +15 分，全部完成开宝箱（随机 +20~80 分）。
- **连击与幸运暴击**：2 分钟内连续完成项目，从第 3 次起每次额外加分（最高 +5）；每次完成有 12% 概率暴击 +10 分。
- **升级与成就庆祝**：解锁成就、升级、开宝箱时弹出撒花庆祝；等级称号扩展到 11 个。
- **连续学习火焰**、**近 5 周学习热力图**、右上角音效 / 震动开关。
- **分页界面（v1.2）**：底部悬浮标签栏分为「专注 / 数据 / 成就」三页；专注页是圆环计时器 + 今日任务 + 学习目标，切到其他页时计时中会出现一个迷你计时胶囊，点一下回到专注页。
- 新增数据全部存放在原有的 `flags` 字段里，后端和数据库无需任何改动，旧数据和旧成就完全兼容。

## 常见问题
- **页面提示“无法连接服务器”**：检查 Worker 是否部署成功，以及 D1 是否已绑定（Settings → Bindings 中应有 `DB`）。
- **一直弹出口令输入框**：口令与 `ACCESS_TOKEN` 不一致；删除该 Secret 即可关闭口令保护。
- **构建失败提示 Worker 名称不匹配**：把控制台里的 Worker 名称改成 `jp-learn`，或同步修改 `wrangler.jsonc` 的 `name`。
