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

### 3. 启动项目

```bash
npm run dev
```

启动后访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

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
