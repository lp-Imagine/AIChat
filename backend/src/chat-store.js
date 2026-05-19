import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const dataDir = path.resolve(process.cwd(), 'data')
const chatsFile = path.join(dataDir, 'chats.json')

function createDefaultStore() {
  return {
    sessions: [],
    messages: []
  }
}

async function ensureChatsFile() {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(chatsFile)
  } catch {
    await fs.writeFile(chatsFile, JSON.stringify(createDefaultStore(), null, 2), 'utf-8')
  }
}

async function readStore() {
  await ensureChatsFile()
  const content = await fs.readFile(chatsFile, 'utf-8')

  try {
    const parsed = JSON.parse(content)
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    }
  } catch {
    return createDefaultStore()
  }
}

async function writeStore(store) {
  await ensureChatsFile()
  await fs.writeFile(chatsFile, JSON.stringify(store, null, 2), 'utf-8')
}

function buildSessionTitle(content) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 30) || '新对话'
}

function sortByUpdatedAtDesc(a, b) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

export async function listUserSessions(userId) {
  const store = await readStore()

  return store.sessions
    .filter((session) => session.userId === userId)
    .sort(sortByUpdatedAtDesc)
}

export async function createSession(userId, firstMessage = '') {
  const store = await readStore()
  const now = new Date().toISOString()
  const session = {
    id: crypto.randomUUID(),
    userId,
    title: buildSessionTitle(firstMessage),
    createdAt: now,
    updatedAt: now
  }

  store.sessions.push(session)
  await writeStore(store)
  return session
}

export async function getSessionById(sessionId) {
  const store = await readStore()
  return store.sessions.find((session) => session.id === sessionId) || null
}

export async function listSessionMessages(sessionId) {
  const store = await readStore()

  return store.messages
    .filter((message) => message.sessionId === sessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function createMessage({ sessionId, role, content }) {
  const store = await readStore()
  const now = new Date().toISOString()
  const message = {
    id: crypto.randomUUID(),
    sessionId,
    role,
    content,
    createdAt: now,
    updatedAt: now
  }

  store.messages.push(message)
  const session = store.sessions.find((item) => item.id === sessionId)

  if (session) {
    if (role === 'user' && (!session.title || session.title === '新对话')) {
      session.title = buildSessionTitle(content)
    }

    session.updatedAt = now
  }

  await writeStore(store)
  return message
}

export async function updateMessageContent(messageId, content) {
  const store = await readStore()
  const message = store.messages.find((item) => item.id === messageId)

  if (!message) {
    return null
  }

  message.content = content
  message.updatedAt = new Date().toISOString()
  await writeStore(store)
  return message
}

export async function touchSession(sessionId) {
  const store = await readStore()
  const session = store.sessions.find((item) => item.id === sessionId)

  if (!session) {
    return null
  }

  session.updatedAt = new Date().toISOString()
  await writeStore(store)
  return session
}

export async function renameSession(sessionId, title) {
  const store = await readStore()
  const session = store.sessions.find((item) => item.id === sessionId)

  if (!session) {
    return null
  }

  session.title = title.trim() || '新对话'
  session.updatedAt = new Date().toISOString()
  await writeStore(store)
  return session
}

export async function deleteSession(sessionId) {
  const store = await readStore()
  const sessionIndex = store.sessions.findIndex((item) => item.id === sessionId)

  if (sessionIndex === -1) {
    return false
  }

  store.sessions.splice(sessionIndex, 1)
  store.messages = store.messages.filter((message) => message.sessionId !== sessionId)
  await writeStore(store)
  return true
}

export async function clearSessionMessages(sessionId) {
  const store = await readStore()
  const session = store.sessions.find((item) => item.id === sessionId)

  if (!session) {
    return false
  }

  store.messages = store.messages.filter((message) => message.sessionId !== sessionId)
  session.updatedAt = new Date().toISOString()
  await writeStore(store)
  return true
}

export async function deleteLastAssistantMessage(sessionId) {
  const store = await readStore()
  const sessionMessages = store.messages
    .filter((message) => message.sessionId === sessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  for (let index = sessionMessages.length - 1; index >= 0; index -= 1) {
    const currentMessage = sessionMessages[index]

    if (currentMessage.role !== 'assistant') {
      continue
    }

    store.messages = store.messages.filter((message) => message.id !== currentMessage.id)
    const session = store.sessions.find((item) => item.id === sessionId)

    if (session) {
      session.updatedAt = new Date().toISOString()
    }

    await writeStore(store)
    return currentMessage
  }

  return null
}
