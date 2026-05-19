export interface ChatMessage {
  id?: string
  sessionId?: string
  role: 'user' | 'assistant'
  content: string
  displayContent?: string
  isStreaming?: boolean
  searchResults?: SearchResult[]
  weatherInfo?: WeatherInfo
  createdAt?: string
  updatedAt?: string
}

export interface ChatRequest {
  message: string
  sessionId?: string
  enableWebSearch?: boolean
}

export interface ChatResponse {
  reply: string
  session?: ChatSession
  assistantMessage?: ChatMessage
}

export interface ChatSession {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface StreamChunk {
  content?: string
  done?: boolean
  error?: string
  session?: ChatSession
  searchResults?: SearchResult[]
  searchWarning?: string
  weatherInfo?: WeatherInfo
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface WeatherInfo {
  city: string
  latitude: number
  longitude: number
  current: {
    time: string
    temperature: number
    humidity: number
    windSpeed: number
    weatherCode: number
    weatherText: string
  }
  today: {
    maxTemperature: number
    minTemperature: number
    weatherCode: number
    weatherText: string
  }
}
