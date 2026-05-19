import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  timeout: 60000
})

function buildMessages(message, history = [], options = {}) {
  const searchContext = options.searchContext?.trim()
  const messages = [
    {
      role: 'system',
      content: '你是一名专业的 AI 应用开发助手，擅长帮助用户完成智能问答助手项目开发。'
    },
    ...history.map((item) => ({
      role: item.role,
      content: item.content
    })),
    {
      role: 'user',
      content: message
    }
  ]

  if (searchContext) {
    messages.splice(messages.length - 1, 0, {
      role: 'system',
      content: `以下是本轮联网搜索得到的参考资料，请优先基于这些信息回答，并在回答里自然引用关键信息：\n\n${searchContext}`
    })
  }

  return messages
}

export async function createChatCompletion(message, history = [], options = {}) {
  const messages = buildMessages(message, history, options)

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    temperature: 0.7
  })

  return completion.choices[0]?.message?.content || '暂时没有生成回复，请稍后重试。'
}

export async function createChatCompletionStream(message, history = [], options = {}) {
  const messages = buildMessages(message, history, options)

  return client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    stream: true
  })
}
