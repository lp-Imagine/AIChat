# AIChat

一个面向学习和实战的 AI 智能问答助手项目，整体风格参考 DeepSeek / 豆包，支持登录注册、会话管理、流式输出、打字机效果、Markdown 渲染、代码高亮，以及天气类联网查询。

## 技术栈

- 前端：`Vue 3` + `TypeScript` + `Element Plus` + `Vite`
- 后端：`Node.js` + `Express`
- 模型接入：`OpenAI SDK`，当前已适配 `DeepSeek` 接口风格
- 联网能力：
  - 通用搜索：DuckDuckGo 轻量搜索链路
  - 天气查询：`Open-Meteo` 实时天气接口

推荐 Node.js 版本：`23.x`

## 当前已实现

- 用户注册 / 登录
- 基于本地 JSON 的轻量用户与会话存储
- 多会话管理
- 历史消息持久化
- 刷新后恢复当前会话
- AI 流式输出
- 打字机逐字渲染
- 停止生成
- 重新生成上一条 AI 回复
- 消息复制 / 代码复制
- Markdown 渲染
- 代码高亮
- 代码块工具栏
- 输入框自适应高度
- 消息区域独立滚动与自动跟底
- 天气类联网查询

## 项目结构

```text
AIChat
├─ frontend                # Vue 3 前端
├─ backend                 # Express 后端
│  ├─ src
│  │  ├─ auth.js           # 登录注册与 token 校验
│  │  ├─ chat-store.js     # 会话与消息存储
│  │  ├─ index.js          # API 入口
│  │  ├─ openai.js         # 模型调用封装
│  │  ├─ search.js         # 通用联网搜索
│  │  └─ weather.js        # 天气联网能力
│  └─ data                 # 本地 JSON 数据
└─ package.json
```

## 快速启动

### 1. 安装依赖

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`

```bash
cp backend/.env.example backend/.env
```

当前至少需要配置：

```env
PORT=3001
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
```

前端本地开发可新增：

```env
VITE_API_BASE_URL=http://localhost:3001
```

### 3. 启动项目

```bash
npm run dev
```

启动后访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

## 免费部署建议

推荐使用前后端分离部署：

- 前端：`Vercel`
- 后端：`Railway`
- CI：`GitHub Actions`

### 1. 部署后端到 Railway

- 新建服务并连接当前 GitHub 仓库
- 推荐设置 `Root Directory`：`backend`
- `Build Command`：`npm install`
- `Start Command`：`npm start`
- 环境变量至少配置：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL=https://api.deepseek.com`
  - `OPENAI_MODEL=deepseek-v4-flash`
  - `CORS_ORIGIN=https://你的-vercel-域名`

如果 Railway 没有正确设置 `Root Directory`，后端会在仓库根目录执行命令，并出现：

```text
npm error Missing script: "start"
```

这时有两种修法：

- 正确修法：把 `Root Directory` 设为 `backend`
- 临时兜底：
  - `Build Command`：`npm --prefix backend install`
  - `Start Command`：`npm --prefix backend start`

说明：

- 当前项目的用户、会话数据使用本地 JSON 文件存储
- 在 Railway 这类平台上通常可以运行，但实例重建后数据可能丢失
- 如果要长期稳定使用，后续建议切换数据库

### 2. 部署前端到 Vercel

- 导入当前 GitHub 仓库
- `Root Directory`：`frontend`
- `Build Command`：`npm run build`
- `Install Command`：`npm install`
- `Output Directory`：`dist`
- `frontend/vercel.json` 需要保留 SPA rewrite，避免刷新 `/chat` 等路由时出现 404
- 环境变量：
  - `VITE_API_BASE_URL=https://你的-railway-后端域名`

### 3. GitHub Actions

- 仓库已内置 `.github/workflows/ci.yml`
- 每次 push / pull request 会自动检查前后端构建是否通过

## 部署排障

- Vercel 刷新页面出现 `404 NOT_FOUND`
  - 原因：前端使用 `Vue Router history` 模式，服务端没有把路由 rewrite 到 `index.html`
  - 处理：保留 [frontend/vercel.json](/Users/luopeng/Documents/AIChat/frontend/vercel.json)

- 前端请求后端出现 `502 Bad Gateway`
  - 先访问 `/api/health` 判断后端是否真正启动
  - 如果 Railway 日志里出现 `Missing script: "start"`，基本就是没有把服务运行目录切到 `backend`

- Vercel 构建报 `frontend/frontend/package.json`
  - 原因：`Root Directory=frontend` 时，构建命令仍然写成了 `npm --prefix frontend ...`
  - 处理：改成 `npm install` + `npm run build`

## 联网能力说明

当前“联网搜索”更适合用来演示和学习两类能力：

- 天气类问题：
  - 例如：`今天南昌的天气如何`
  - 会优先调用 `Open-Meteo` 获取实时天气数据

- 普通联网问题：
  - 目前接了轻量搜索链路，适合学习流程
  - 如果你希望达到更像正式产品的联网问答效果，后续建议替换成更稳定的搜索服务

## 体验亮点

- AI 回复支持流式打字机效果
- 流式阶段对 Markdown 和代码块做了稳定渲染优化
- 代码块支持高亮和复制
- 消息卡片支持复制与重新生成
- 对话滚动区域与浏览器页面滚动分离

## 后续可继续扩展

1. 更稳定的正式联网搜索服务
2. 更多天气查询场景：明天、未来 3 天、城市对比
3. 文件上传问答
4. RAG 知识库
5. 数据库替换本地 JSON
6. 更完善的权限与 token 机制
7. 深色模式与移动端细节打磨
