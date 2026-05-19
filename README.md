# AIChat

一个基于 `Vue 3 + Element Plus + TypeScript + Node.js + Express + OpenAI` 的 AI 智能问答对话助手实战项目。

推荐 Node.js 版本：`23.5.0`

## 项目结构

```text
AIChat
├─ frontend  # 聊天前端
├─ backend   # 聊天后端
└─ package.json
```

## 快速启动

### 1. 安装依赖

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

### 2. 配置后端环境变量

复制 `backend/.env.example` 为 `backend/.env`，填写你的 OpenAI Key：

```bash
cp backend/.env.example backend/.env
```

### 3. 启动项目

```bash
npm run dev
```

- 前端地址：`http://localhost:5173`
- 后端地址：`http://localhost:3001`

## 当前已实现

- 基础聊天界面
- 会话消息列表
- 输入发送
- 后端 `/api/chat` 接口
- 后端 `/api/chat/stream` 流式输出接口
- OpenAI 聊天模型调用
- 前端流式渲染回复内容
- `Enter` 发送、`Shift + Enter` 换行
- 前端开发代理

## 下一步建议

1. 接入流式输出
2. 增加多轮上下文记忆
3. 增加会话列表和本地存储
4. 增加 Markdown 渲染
5. 增加代码高亮和复制功能
