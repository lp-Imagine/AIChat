import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createChatCompletion, createChatCompletionStream } from './openai.js'
import { getUserByToken, loginUser, registerUser } from './auth.js'
import { buildSearchContext, searchWeb } from './search.js'
import { buildWeatherContext, detectWeatherIntent, extractCityFromWeatherQuery, fetchWeatherByQuery } from './weather.js'
import {
  clearSessionMessages,
  createMessage,
  createSession,
  deleteLastAssistantMessage,
  deleteSession,
  getSessionById,
  listSessionMessages,
  listUserSessions,
  updateMessageContent
} from './chat-store.js'

const app = express()
const port = Number(process.env.PORT || 3000)

app.use(cors())
app.use(express.json())

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const user = await getUserByToken(token)

  if (!user) {
    return res.status(401).json({
      error: '登录状态已失效，请重新登录'
    })
  }

  req.user = user
  next()
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'backend server is running'
  })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({
      error: '用户名和密码不能为空'
    })
  }

  try {
    const result = await registerUser({ username, password })
    return res.json(result)
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : '注册失败'
    })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({
      error: '用户名和密码不能为空'
    })
  }

  try {
    const result = await loginUser({ username, password })
    return res.json(result)
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : '登录失败'
    })
  }
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    user: req.user
  })
})

app.get('/api/chat/sessions', authMiddleware, async (req, res) => {
  const sessions = await listUserSessions(req.user.id)
  res.json({ sessions })
})

app.post('/api/chat/sessions', authMiddleware, async (req, res) => {
  const { title = '新对话', firstMessage = '' } = req.body || {}
  const session = await createSession(req.user.id, firstMessage || title)

  if (title && !firstMessage && title !== '新对话') {
    session.title = title
  }

  res.json({ session })
})

app.get('/api/chat/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  const session = await getSessionById(req.params.sessionId)

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({
      error: '会话不存在'
    })
  }

  const messages = await listSessionMessages(session.id)
  return res.json({
    session,
    messages
  })
})

app.delete('/api/chat/sessions/:sessionId', authMiddleware, async (req, res) => {
  const session = await getSessionById(req.params.sessionId)

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({
      error: '会话不存在'
    })
  }

  await deleteSession(session.id)
  return res.json({
    success: true
  })
})

app.delete('/api/chat/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  const session = await getSessionById(req.params.sessionId)

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({
      error: '会话不存在'
    })
  }

  await clearSessionMessages(session.id)
  return res.json({
    success: true
  })
})

app.post('/api/chat', authMiddleware, async (req, res) => {
  const { message, sessionId, enableWebSearch = false } = req.body || {}

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'message 参数不能为空'
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: '未配置 OPENAI_API_KEY，请先在 backend/.env 中设置。'
    })
  }

  try {
    let session = sessionId ? await getSessionById(sessionId) : null

    if (session && session.userId !== req.user.id) {
      return res.status(403).json({
        error: '无权访问该会话'
      })
    }

    if (!session) {
      session = await createSession(req.user.id, message)
    }

    let searchContext = ''
    let weatherInfo = null

    if (enableWebSearch) {
      if (detectWeatherIntent(message)) {
        const city = extractCityFromWeatherQuery(message) || message
        weatherInfo = await fetchWeatherByQuery(city)
        searchContext = buildWeatherContext(weatherInfo)
      } else {
        const searchResponse = await searchWeb(message)
        const searchResults = searchResponse.results
        searchContext = buildSearchContext(searchResults)
      }
    }

    const sessionMessages = await listSessionMessages(session.id)
    const history = sessionMessages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        role: item.role,
        content: item.content
      }))

    await createMessage({
      sessionId: session.id,
      role: 'user',
      content: message
    })

    const reply = await createChatCompletion(message, history, {
      searchContext
    })
    await createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: reply
    })

    return res.json({ reply, session, weatherInfo })
  } catch (error) {
    console.error('OpenAI request failed:', error)

    return res.status(500).json({
      error: '调用 AI 接口失败，请稍后重试。'
    })
  }
})

app.post('/api/chat/regenerate', authMiddleware, async (req, res) => {
  const { sessionId } = req.body || {}

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'sessionId 参数不能为空'
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: '未配置 OPENAI_API_KEY，请先在 backend/.env 中设置。'
    })
  }

  try {
    const session = await getSessionById(sessionId)

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({
        error: '会话不存在'
      })
    }

    await deleteLastAssistantMessage(session.id)
    const sessionMessages = await listSessionMessages(session.id)
    const lastUserMessage = [...sessionMessages].reverse().find((item) => item.role === 'user')

    if (!lastUserMessage) {
      return res.status(400).json({
        error: '当前会话没有可重新生成的用户消息'
      })
    }

    const history = sessionMessages
      .filter((item) => item.id !== lastUserMessage.id)
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        role: item.role,
        content: item.content
      }))

    const reply = await createChatCompletion(lastUserMessage.content, history)
    const assistantMessage = await createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: reply
    })

    return res.json({
      reply,
      session,
      assistantMessage
    })
  } catch (error) {
    console.error('Regenerate request failed:', error)
    return res.status(500).json({
      error: '重新生成失败，请稍后重试。'
    })
  }
})

app.post('/api/chat/regenerate/stream', authMiddleware, async (req, res) => {
  const { sessionId } = req.body || {}

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'sessionId 参数不能为空'
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: '未配置 OPENAI_API_KEY，请先在 backend/.env 中设置。'
    })
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const session = await getSessionById(sessionId)

    if (!session || session.userId !== req.user.id) {
      res.write(`data: ${JSON.stringify({ error: '会话不存在' })}\n\n`)
      return res.end()
    }

    await deleteLastAssistantMessage(session.id)
    const sessionMessages = await listSessionMessages(session.id)
    const lastUserMessage = [...sessionMessages].reverse().find((item) => item.role === 'user')

    if (!lastUserMessage) {
      res.write(`data: ${JSON.stringify({ error: '当前会话没有可重新生成的用户消息' })}\n\n`)
      return res.end()
    }

    const history = sessionMessages
      .filter((item) => item.id !== lastUserMessage.id)
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        role: item.role,
        content: item.content
      }))

    const stream = await createChatCompletionStream(lastUserMessage.content, history)
    const assistantMessage = await createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: ''
    })
    let assistantContent = ''

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        assistantContent += content
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }

    await updateMessageContent(assistantMessage.id, assistantContent)
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    return res.end()
  } catch (error) {
    console.error('Regenerate stream request failed:', error)
    res.write(`data: ${JSON.stringify({ error: '重新生成失败，请稍后重试。' })}\n\n`)
    return res.end()
  }
})

app.post('/api/chat/stream', authMiddleware, async (req, res) => {
  const { message, sessionId, enableWebSearch = false } = req.body || {}

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'message 参数不能为空'
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: '未配置 OPENAI_API_KEY，请先在 backend/.env 中设置。'
    })
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    let session = sessionId ? await getSessionById(sessionId) : null

    if (session && session.userId !== req.user.id) {
      res.write(`data: ${JSON.stringify({ error: '无权访问该会话' })}\n\n`)
      return res.end()
    }

    if (!session) {
      session = await createSession(req.user.id, message)
      res.write(`data: ${JSON.stringify({ session })}\n\n`)
    }

    let searchContext = ''
    let searchResults = []
    let weatherInfo = null

    if (enableWebSearch) {
      try {
        if (detectWeatherIntent(message)) {
          const city = extractCityFromWeatherQuery(message) || message
          weatherInfo = await fetchWeatherByQuery(city)
          searchContext = buildWeatherContext(weatherInfo)
          if (weatherInfo) {
            res.write(`data: ${JSON.stringify({ weatherInfo })}\n\n`)
          } else {
            res.write(`data: ${JSON.stringify({ searchWarning: '未识别到有效城市，以下回答基于模型自身知识生成。' })}\n\n`)
          }
        } else {
          const searchResponse = await searchWeb(message)
          searchResults = searchResponse.results
          searchContext = buildSearchContext(searchResults)

          if (searchResults.length > 0) {
            res.write(`data: ${JSON.stringify({ searchResults })}\n\n`)
          } else {
            res.write(`data: ${JSON.stringify({ searchWarning: '本次联网搜索没有获取到有效结果，以下回答基于模型自身知识生成。' })}\n\n`)
          }
        }
      } catch (error) {
        console.error('Web search failed:', error)
        res.write(`data: ${JSON.stringify({ searchWarning: '联网能力暂时不可用，以下回答基于模型自身知识生成。' })}\n\n`)
      }
    }

    const sessionMessages = await listSessionMessages(session.id)
    const history = sessionMessages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        role: item.role,
        content: item.content
      }))

    await createMessage({
      sessionId: session.id,
      role: 'user',
      content: message
    })

    const stream = await createChatCompletionStream(message, history, {
      searchContext
    })
    const assistantMessage = await createMessage({
      sessionId: session.id,
      role: 'assistant',
      content: ''
    })
    let assistantContent = ''

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content

      if (content) {
        assistantContent += content
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }

    await updateMessageContent(assistantMessage.id, assistantContent)
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    return res.end()
  } catch (error) {
    console.error('OpenAI stream request failed:', error)
    res.write(`data: ${JSON.stringify({ error: '调用 AI 流式接口失败，请稍后重试。' })}\n\n`)
    return res.end()
  }
})

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
})
