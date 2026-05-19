<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, DocumentCopy, Plus, Promotion, RefreshRight, Search, SwitchButton, User } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  clearSessionMessages,
  createSession,
  fetchSessionMessages,
  fetchSessions,
  removeSession,
  streamRegenerateMessage,
  streamChatMessage
} from '../api/chat'
import { clearAuth, getStoredUser, getToken } from '../utils/auth'
import type { ChatMessage, ChatSession, SearchResult, WeatherInfo } from '../types'
import { renderMarkdown, renderStreamingMarkdown } from '../utils/markdown'

const router = useRouter()
const currentUser = ref(getStoredUser())
const token = getToken()
const sessions = ref<ChatSession[]>([])
const activeSessionId = ref('')
const messages = ref<ChatMessage[]>([])
const inputValue = ref('')
const enableWebSearch = ref(false)
const loading = ref(false)
const sessionsLoading = ref(false)
const thinking = ref(false)
const pendingSearchResults = ref<SearchResult[]>([])
const pendingSearchWarning = ref('')
const pendingWeatherInfo = ref<WeatherInfo | null>(null)
const messageListRef = ref<HTMLElement | null>(null)
const inputRef = ref()
let copyFeedbackTimer: number | null = null
const shouldStickToBottom = ref(true)
let autoScrolling = false
let streamAbortController: AbortController | null = null
let scrollFollowFrameA: number | null = null
let scrollFollowFrameB: number | null = null

const defaultAssistantMessage: ChatMessage = {
  role: 'assistant',
  content: '你好，我是你的 AI 智能问答助手。你可以继续之前的对话，也可以新建一个会话开始提问。',
  displayContent: '你好，我是你的 AI 智能问答助手。你可以继续之前的对话，也可以新建一个会话开始提问。',
  isStreaming: false
}

const canSend = computed(() => inputValue.value.trim().length > 0 && !loading.value)
const activeSession = computed(() => sessions.value.find((item) => item.id === activeSessionId.value) || null)

function ensureDisplayContent(list: ChatMessage[]) {
  return list.map((message) => ({
    ...message,
    displayContent: message.role === 'assistant' ? message.content : message.content,
    searchResults: message.searchResults || [],
    weatherInfo: message.weatherInfo || null,
    isStreaming: false
  }))
}

function setWelcomeMessages() {
  messages.value = [{ ...defaultAssistantMessage }]
}

function renderMessageContent(message: ChatMessage) {
  const displayContent = message.role === 'user'
    ? message.content
    : message.displayContent ?? ''

  if (message.role === 'user') {
    return displayContent.replace(/\n/g, '<br>')
  }

  if (message.isStreaming) {
    return renderStreamingMarkdown(displayContent)
  }

  return renderMarkdown(displayContent)
}

function renderSearchResults(results: SearchResult[]) {
  return results.map((item, index) => `
    <div class="search-result-card">
      <div class="search-result-index">联网参考 ${index + 1}</div>
      <a href="${item.url}" target="_blank" rel="noreferrer" class="search-result-title">${item.title}</a>
      <p class="search-result-snippet">${item.snippet}</p>
    </div>
  `).join('')
}

function renderWeatherInfo(weatherInfo: WeatherInfo) {
  return `
    <div class="weather-card">
      <div class="weather-card-city">${weatherInfo.city}</div>
      <div class="weather-card-main">
        <strong>${weatherInfo.current.temperature}°C</strong>
        <span>${weatherInfo.current.weatherText}</span>
      </div>
      <div class="weather-card-meta">
        <span>湿度 ${weatherInfo.current.humidity}%</span>
        <span>风速 ${weatherInfo.current.windSpeed} km/h</span>
        <span>最高 ${weatherInfo.today.maxTemperature}°C</span>
        <span>最低 ${weatherInfo.today.minTemperature}°C</span>
      </div>
    </div>
  `
}

async function handleMessageClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const copyButton = target?.closest('.copy-code-button') as HTMLButtonElement | null

  if (!copyButton) {
    return
  }

  const code = copyButton.dataset.code || ''
  const originalLabel = copyButton.textContent || '复制代码'

  try {
    await navigator.clipboard.writeText(code)
    if (copyFeedbackTimer !== null) {
      window.clearTimeout(copyFeedbackTimer)
    }

    copyButton.textContent = '已复制'
    copyButton.disabled = true
    copyFeedbackTimer = window.setTimeout(() => {
      copyButton.textContent = originalLabel
      copyButton.disabled = false
      copyFeedbackTimer = null
    }, 1600)
  } catch (error) {
    console.error(error)
    ElMessage.error('复制失败，请稍后重试')
  }
}

async function copyMessageContent(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('消息已复制')
  } catch (error) {
    console.error(error)
    ElMessage.error('复制失败，请稍后重试')
  }
}

async function scrollToBottom() {
  await nextTick()
  const container = messageListRef.value

  if (!container) {
    return
  }

  autoScrolling = true
  container.scrollTop = container.scrollHeight

  if (scrollFollowFrameA !== null) {
    cancelAnimationFrame(scrollFollowFrameA)
  }
  if (scrollFollowFrameB !== null) {
    cancelAnimationFrame(scrollFollowFrameB)
  }

  scrollFollowFrameA = requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight
    scrollFollowFrameB = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
      autoScrolling = false
      scrollFollowFrameA = null
      scrollFollowFrameB = null
    })
  })
}

function updateStickToBottom() {
  const container = messageListRef.value

  if (!container || autoScrolling) {
    return
  }

  const threshold = 96
  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  shouldStickToBottom.value = distanceToBottom <= threshold
}

function resizeInput() {
  const textarea = inputRef.value?.textarea as HTMLTextAreaElement | undefined

  if (!textarea) {
    return
  }

  textarea.style.height = 'auto'
  const nextHeight = Math.min(textarea.scrollHeight, 180)
  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY = textarea.scrollHeight > 180 ? 'auto' : 'hidden'
}

function persistActiveSession(sessionId: string) {
  localStorage.setItem(`aichat_active_session_${currentUser.value?.id || 'guest'}`, sessionId)
}

function getPersistedActiveSession() {
  return localStorage.getItem(`aichat_active_session_${currentUser.value?.id || 'guest'}`) || ''
}

function moveSessionToTop(session: ChatSession) {
  sessions.value = [session, ...sessions.value.filter((item) => item.id !== session.id)]
}

async function loadSessions() {
  sessionsLoading.value = true

  try {
    const sessionList = await fetchSessions(token)
    sessions.value = sessionList

    if (sessionList.length === 0) {
      activeSessionId.value = ''
      setWelcomeMessages()
      return
    }

    const persistedId = getPersistedActiveSession()
    const targetId = sessionList.some((item) => item.id === persistedId) ? persistedId : sessionList[0].id
    await selectSession(targetId)
  } catch (error) {
    console.error(error)
    handleAuthError(error)
  } finally {
    sessionsLoading.value = false
  }
}

async function selectSession(sessionId: string) {
  if (!sessionId) {
    activeSessionId.value = ''
    setWelcomeMessages()
    return
  }

  activeSessionId.value = sessionId
  persistActiveSession(sessionId)

  try {
    const { messages: historyMessages } = await fetchSessionMessages(sessionId, token)
    messages.value = historyMessages.length > 0 ? ensureDisplayContent(historyMessages) : [{ ...defaultAssistantMessage }]
    shouldStickToBottom.value = true
    await scrollToBottom()
  } catch (error) {
    console.error(error)
    handleAuthError(error)
  }
}

async function handleCreateSession() {
  if (loading.value) {
    return
  }

  try {
    const session = await createSession({ title: '新对话' }, token)
    moveSessionToTop(session)
    activeSessionId.value = session.id
    persistActiveSession(session.id)
    setWelcomeMessages()
    inputValue.value = ''
    resizeInput()
    await scrollToBottom()
  } catch (error) {
    console.error(error)
    handleAuthError(error)
  }
}

async function handleDeleteSession(session: ChatSession) {
  try {
    await ElMessageBox.confirm(`确认删除会话“${session.title}”吗？`, '删除确认', {
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await removeSession(session.id, token)
    sessions.value = sessions.value.filter((item) => item.id !== session.id)

    if (activeSessionId.value === session.id) {
      const nextSession = sessions.value[0]
      if (nextSession) {
        await selectSession(nextSession.id)
      } else {
        activeSessionId.value = ''
        persistActiveSession('')
        setWelcomeMessages()
      }
    }

    ElMessage.success('会话已删除')
  } catch (error) {
    console.error(error)
    handleAuthError(error)
  }
}

async function handleClearCurrentSession() {
  if (!activeSessionId.value || loading.value) {
    return
  }

  try {
    await ElMessageBox.confirm('确认清空当前会话的全部消息吗？', '清空确认', {
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await clearSessionMessages(activeSessionId.value, token)
    setWelcomeMessages()
    ElMessage.success('当前会话已清空')
  } catch (error) {
    console.error(error)
    handleAuthError(error)
  }
}

function createMessageTypewriter(messageIndex: number) {
  let buffer = ''
  let timer: number | null = null
  let idleResolve: (() => void) | null = null
  let lastScrollTime = 0

  const stop = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const resolveIdle = () => {
    idleResolve?.()
    idleResolve = null
  }

  const tick = () => {
    if (buffer.length === 0) {
      stop()
      resolveIdle()
      return
    }

    const chars = buffer.slice(0, 1)
    buffer = buffer.slice(1)
    const currentMessage = messages.value[messageIndex]

    if (!currentMessage) {
      stop()
      resolveIdle()
      return
    }

    messages.value[messageIndex] = {
      ...currentMessage,
      displayContent: (currentMessage.displayContent || '') + chars
    }

    const now = Date.now()
    if (shouldStickToBottom.value && now - lastScrollTime > 48) {
      lastScrollTime = now
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }

    timer = window.setTimeout(tick, 35)
  }

  const append = (text: string) => {
    buffer += text

    if (timer === null) {
      tick()
    }
  }

  const waitForIdle = () => {
    if (buffer.length === 0 && timer === null) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      idleResolve = resolve
    })
  }

  return {
    append,
    waitForIdle,
    stop
  }
}

function syncSessionTitleFromFirstUserMessage(sessionId: string, content: string) {
  const title = content.replace(/\s+/g, ' ').trim().slice(0, 30) || '新对话'
  sessions.value = sessions.value.map((item) => item.id === sessionId ? { ...item, title } : item)
}

function handleAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('401')) {
    clearAuth()
    router.push('/login')
    return
  }

  ElMessage.error('请求失败，请检查服务状态')
}

function getLatestAssistantMessageIndex() {
  for (let index = messages.value.length - 1; index >= 0; index -= 1) {
    const message = messages.value[index]
    if (message.role === 'assistant' && message.content.trim()) {
      return index
    }
  }

  return -1
}

function isLatestAssistantMessage(index: number) {
  return index === getLatestAssistantMessageIndex()
}

function stopGenerating() {
  if (!streamAbortController) {
    return
  }

  streamAbortController.abort()
  streamAbortController = null
}

async function handleSend() {
  const content = inputValue.value.trim()

  if (!content || loading.value) {
    return
  }

  const userMessage: ChatMessage = { role: 'user', content }
  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: '',
    displayContent: '',
    isStreaming: true
  }

  if (messages.value.length === 1 && messages.value[0].role === 'assistant' && messages.value[0].content === defaultAssistantMessage.content) {
    messages.value = []
  }

  messages.value.push(userMessage)
  messages.value.push(assistantMessage)
  const assistantMessageIndex = messages.value.length - 1
  const currentSessionId = activeSessionId.value

  inputValue.value = ''
  loading.value = true
  thinking.value = true
  pendingSearchResults.value = []
  pendingSearchWarning.value = ''
  pendingWeatherInfo.value = null
  shouldStickToBottom.value = true
  resizeInput()
  const typewriter = createMessageTypewriter(assistantMessageIndex)
  streamAbortController = new AbortController()

  if (currentSessionId) {
    syncSessionTitleFromFirstUserMessage(currentSessionId, content)
  }

  await scrollToBottom()

  try {
    await streamChatMessage(
      {
        message: content,
        sessionId: currentSessionId || undefined,
        enableWebSearch: enableWebSearch.value
      },
      {
        onSession(session) {
          activeSessionId.value = session.id
          persistActiveSession(session.id)
          moveSessionToTop(session)
        },
        onSearchResults(results) {
          pendingSearchResults.value = results
        },
        onSearchWarning(message) {
          pendingSearchWarning.value = message
        },
        onWeatherInfo(weatherInfo) {
          pendingWeatherInfo.value = weatherInfo
        },
        onChunk(chunk) {
          thinking.value = false
          const currentMessage = messages.value[assistantMessageIndex]
          if (!currentMessage) {
            return
          }

          messages.value[assistantMessageIndex] = {
            ...currentMessage,
            content: currentMessage.content + chunk
          }
          typewriter.append(chunk)
        },
        async onDone() {
          await typewriter.waitForIdle()
        },
        async onError(message) {
          throw new Error(message)
        }
      },
      token,
      streamAbortController.signal
    )

    const finalMessage = messages.value[assistantMessageIndex]
    if (finalMessage) {
      const searchResults = pendingSearchResults.value
      const searchWarning = pendingSearchWarning.value
      const weatherInfo = pendingWeatherInfo.value
      messages.value[assistantMessageIndex] = {
        ...finalMessage,
        displayContent: finalMessage.displayContent || finalMessage.content,
        searchResults: searchResults.length
          ? searchResults
          : searchWarning
            ? [{
                title: '联网搜索提示',
                url: '#',
                snippet: searchWarning
              }]
            : [],
        weatherInfo,
        isStreaming: false
      }
    }

    const latestSessions = await fetchSessions(token)
    sessions.value = latestSessions
    if (activeSessionId.value) {
      persistActiveSession(activeSessionId.value)
    }
  } catch (error) {
    console.error(error)
    typewriter.stop()
    const message = error instanceof Error ? error.message : String(error)
    const finalMessage = messages.value[assistantMessageIndex]

    if (finalMessage && finalMessage.content) {
      messages.value[assistantMessageIndex] = {
        ...finalMessage,
        displayContent: finalMessage.displayContent || finalMessage.content,
        isStreaming: false
      }
    }

    if (message === 'abort') {
      if (finalMessage) {
        messages.value[assistantMessageIndex] = {
          ...finalMessage,
          isStreaming: false
        }
      }
      ElMessage.info('已停止生成')
    } else {
      handleAuthError(error)
    }
  } finally {
    streamAbortController = null
    loading.value = false
    thinking.value = false
    pendingSearchResults.value = []
    pendingSearchWarning.value = ''
    pendingWeatherInfo.value = null
    await scrollToBottom()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  if (event.shiftKey) {
    return
  }

  event.preventDefault()
  handleSend()
}

function handleLogout() {
  clearAuth()
  router.push('/login')
}

async function handleRegenerate() {
  if (!activeSessionId.value || loading.value) {
    return
  }

  const latestAssistantIndex = getLatestAssistantMessageIndex()
  if (latestAssistantIndex === -1) {
    ElMessage.warning('当前没有可重新生成的 AI 回复')
    return
  }

  try {
    loading.value = true
    thinking.value = true
    const existing = messages.value[latestAssistantIndex]
    const streamMessageIndex = latestAssistantIndex
    const typewriter = createMessageTypewriter(streamMessageIndex)
    streamAbortController = new AbortController()

    messages.value[streamMessageIndex] = {
      ...existing,
      content: '',
      displayContent: '',
      isStreaming: true
    }
    shouldStickToBottom.value = true
    await scrollToBottom()

    await streamRegenerateMessage(
      activeSessionId.value,
      {
        onChunk(chunk) {
          thinking.value = false
          const currentMessage = messages.value[streamMessageIndex]
          if (!currentMessage) {
            return
          }

          messages.value[streamMessageIndex] = {
            ...currentMessage,
            content: currentMessage.content + chunk
          }
          typewriter.append(chunk)
        },
        async onDone() {
          await typewriter.waitForIdle()
        },
        async onError(message) {
          throw new Error(message)
        }
      },
      token,
      streamAbortController.signal
    )

    const finalMessage = messages.value[streamMessageIndex]
    if (finalMessage) {
      messages.value[streamMessageIndex] = {
        ...finalMessage,
        isStreaming: false
      }
    }

    sessions.value = await fetchSessions(token)
    await scrollToBottom()
    ElMessage.success('已重新生成')
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'abort') {
      const latestIndex = getLatestAssistantMessageIndex()
      if (latestIndex >= 0) {
        const target = messages.value[latestIndex]
        messages.value[latestIndex] = {
          ...target,
          isStreaming: false
        }
      }
      ElMessage.info('已停止生成')
    } else {
      handleAuthError(error)
    }
  } finally {
    streamAbortController = null
    loading.value = false
    thinking.value = false
  }
}

watch(inputValue, () => {
  nextTick(() => {
    resizeInput()
  })
})

onMounted(async () => {
  resizeInput()
  setWelcomeMessages()
  await loadSessions()
})
</script>

<template>
  <div class="app-shell chat-layout">
    <section class="hero-panel session-panel">
      <div class="session-panel-top">
        <div class="hero-badge">AIChat Project</div>
        <h1>AI 智能问答助手</h1>
        <p>{{ currentUser?.username }}</p>
        <el-button type="primary" :icon="Plus" @click="handleCreateSession">新建对话</el-button>
      </div>

      <div class="session-list" v-loading="sessionsLoading">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeSessionId }"
          type="button"
          @click="selectSession(session.id)"
        >
          <div class="session-item-main">
            <strong>{{ session.title || '新对话' }}</strong>
            <span>{{ new Date(session.updatedAt).toLocaleString() }}</span>
          </div>
          <el-button
            text
            class="session-delete"
            :icon="Delete"
            @click.stop="handleDeleteSession(session)"
          />
        </button>

        <div v-if="!sessions.length && !sessionsLoading" class="session-empty">
          还没有历史对话，先新建一个吧
        </div>
      </div>

      <el-button plain @click="handleLogout">退出登录</el-button>
    </section>

    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <h2>{{ activeSession?.title || '开始对话' }}</h2>
          <span>支持连续上下文追问，刷新后自动恢复历史会话</span>
        </div>
        <div class="chat-toolbar">
          <el-button plain :icon="SwitchButton" :disabled="!loading" @click="stopGenerating">
            停止生成
          </el-button>
          <el-button plain :icon="Delete" :disabled="!activeSessionId || loading" @click="handleClearCurrentSession">
            清空对话
          </el-button>
        </div>
      </header>
      <main ref="messageListRef" class="message-list" @click="handleMessageClick" @scroll="updateStickToBottom">
        <article
          v-for="(message, index) in messages"
          :key="message.id || index"
          class="message-item"
          :class="message.role"
        >
          <div class="message-avatar">
            <el-icon v-if="message.role === 'assistant'"><Promotion /></el-icon>
            <el-icon v-else><User /></el-icon>
          </div>
          <div class="message-bubble">
            <div class="message-role">
              {{ message.role === 'assistant' ? 'AI 助手' : '你' }}
            </div>
            <div
              v-if="message.role === 'assistant' && message.weatherInfo"
              class="weather-result-list"
              v-html="`${renderWeatherInfo(message.weatherInfo)}<div class='search-answer-divider'>AI 综合回答</div>`"
            />
            <div
              v-if="message.role === 'assistant' && message.searchResults?.length"
              class="search-result-list"
              v-html="`${renderSearchResults(message.searchResults)}<div class='search-answer-divider'>AI 综合回答</div>`"
            />
            <div v-if="message.content" class="message-actions">
              <button type="button" class="message-icon-button" @click="copyMessageContent(message.content)" title="复制消息">
                <el-icon><DocumentCopy /></el-icon>
              </button>
              <button
                v-if="message.role === 'assistant' && isLatestAssistantMessage(index)"
                type="button"
                class="message-icon-button"
                :disabled="loading"
                title="重新生成"
                @click="handleRegenerate"
              >
                <el-icon><RefreshRight /></el-icon>
              </button>
            </div>
            <div
              class="message-content"
              v-html="(message.role === 'user' || message.displayContent) ? renderMessageContent(message) : (message.role === 'assistant' && thinking ? '正在思考中...' : '')"
            />
          </div>
        </article>
      </main>

      <footer class="input-panel">
        <el-input
          ref="inputRef"
          v-model="inputValue"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 8 }"
          resize="none"
          placeholder="请输入你的问题，例如：继续上一个方案，帮我补数据库表设计"
          @input="resizeInput"
          @keydown="handleKeydown"
        />
        <div class="input-actions">
          <div class="input-toggles">
            <span>Enter 发送，Shift + Enter 换行</span>
            <label class="search-toggle">
              <el-switch
                v-model="enableWebSearch"
                :disabled="loading"
                inline-prompt
                :active-icon="Search"
              />
              <span>联网搜索</span>
            </label>
          </div>
          <el-button type="primary" :loading="loading" :disabled="!canSend" @click="handleSend">
            发送消息
          </el-button>
        </div>
      </footer>
    </section>
  </div>
</template>
