import axios from 'axios'
import type { ChatRequest, ChatResponse, ChatMessage, ChatSession, SearchResult, StreamChunk, WeatherInfo } from '../types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000
})

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`
}

function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  }
}

export async function sendChatMessage(payload: ChatRequest, token: string) {
  const { data } = await api.post<ChatResponse>('/api/chat', payload, {
    headers: buildAuthHeaders(token)
  })
  return data
}

export async function fetchSessions(token: string) {
  const { data } = await api.get<{ sessions: ChatSession[] }>('/api/chat/sessions', {
    headers: buildAuthHeaders(token)
  })

  return data.sessions
}

export async function createSession(payload: { title?: string; firstMessage?: string }, token: string) {
  const { data } = await api.post<{ session: ChatSession }>('/api/chat/sessions', payload, {
    headers: buildAuthHeaders(token)
  })

  return data.session
}

export async function fetchSessionMessages(sessionId: string, token: string) {
  const { data } = await api.get<{ session: ChatSession; messages: ChatMessage[] }>(
    `/api/chat/sessions/${sessionId}/messages`,
    {
      headers: buildAuthHeaders(token)
    }
  )

  return data
}

export async function removeSession(sessionId: string, token: string) {
  const { data } = await api.delete<{ success: boolean }>(`/api/chat/sessions/${sessionId}`, {
    headers: buildAuthHeaders(token)
  })

  return data
}

export async function clearSessionMessages(sessionId: string, token: string) {
  const { data } = await api.delete<{ success: boolean }>(`/api/chat/sessions/${sessionId}/messages`, {
    headers: buildAuthHeaders(token)
  })

  return data
}

export async function regenerateLastReply(sessionId: string, token: string) {
  const { data } = await api.post<ChatResponse>(
    '/api/chat/regenerate',
    { sessionId },
    {
      headers: buildAuthHeaders(token)
    }
  )

  return data
}

export async function streamRegenerateMessage(
  sessionId: string,
  handlers: {
    onChunk: (content: string) => void
    onDone: () => void | Promise<void>
    onError: (message: string) => void | Promise<void>
  },
  token = '',
  signal?: AbortSignal
) {
  let response: Response
  try {
    response = await fetch(buildApiUrl('/api/chat/regenerate/stream'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal,
      body: JSON.stringify({ sessionId })
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await handlers.onError('abort')
      return
    }
    await handlers.onError(err instanceof Error ? err.message : '网络请求失败')
    return
  }

  if (!response.ok || !response.body) {
    await handlers.onError(`流式请求失败: HTTP ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        if (!event.trim()) continue

        let dataStr = ''
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            dataStr += (dataStr ? '\n' : '') + line.slice(6)
          }
        }

        if (!dataStr) continue

        try {
          const eventData = JSON.parse(dataStr) as StreamChunk
          if (eventData.done) {
            await handlers.onDone()
            return
          }
          if (eventData.error) {
            await handlers.onError(eventData.error)
            return
          }
          if (eventData.content) {
            handlers.onChunk(eventData.content)
          }
        } catch (err) {
          console.error('Failed to parse regenerate stream chunk:', err, dataStr)
        }
      }
    }

    await handlers.onDone()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await handlers.onError('abort')
      return
    }
    await handlers.onError(err instanceof Error ? err.message : '流式读取异常')
  }
}

export async function streamChatMessage(
  payload: ChatRequest,
  handlers: {
    onChunk: (content: string) => void
    onSession?: (session: ChatSession) => void
    onSearchResults?: (results: SearchResult[]) => void
    onSearchWarning?: (message: string) => void
    onWeatherInfo?: (weatherInfo: WeatherInfo) => void
    onDone: () => void | Promise<void>
    onError: (message: string) => void | Promise<void>
  },
  token = '',
  signal?: AbortSignal
) {
  let response: Response
  try {
    response = await fetch(buildApiUrl('/api/chat/stream'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal,
      body: JSON.stringify(payload)
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await handlers.onError('abort')
      return
    }
    await handlers.onError(err instanceof Error ? err.message : '网络请求失败')
    return
  }

  if (!response.ok || !response.body) {
    await handlers.onError(`流式请求失败: HTTP ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        if (!event.trim()) continue

        let dataStr = ''
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            dataStr += (dataStr ? '\n' : '') + line.slice(6)
          }
        }

        if (!dataStr) continue

        if (dataStr.trim() === '[DONE]') {
          await handlers.onDone()
          return
        }

        try {
          const eventData = JSON.parse(dataStr) as StreamChunk

          if (eventData.done) {
            await handlers.onDone()
            return
          }

          if (eventData.session) {
            handlers.onSession?.(eventData.session)
            continue
          }

          if (eventData.searchResults) {
            handlers.onSearchResults?.(eventData.searchResults)
            continue
          }

          if (eventData.searchWarning) {
            handlers.onSearchWarning?.(eventData.searchWarning)
            continue
          }

          if (eventData.weatherInfo) {
            handlers.onWeatherInfo?.(eventData.weatherInfo)
            continue
          }

          if (eventData.error) {
            await handlers.onError(eventData.error)
            return
          }

          if (eventData.content) {
            handlers.onChunk(eventData.content)
          }
        } catch (err) {
          console.error('Failed to parse stream chunk:', err, dataStr)
        }
      }
    }

    await handlers.onDone()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      await handlers.onError('abort')
      return
    }
    await handlers.onError(err instanceof Error ? err.message : '流式读取异常')
  }
}
