import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const dataDir = path.resolve(process.cwd(), 'data')
const usersFile = path.join(dataDir, 'users.json')

async function ensureUsersFile() {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(usersFile)
  } catch {
    await fs.writeFile(usersFile, '[]', 'utf-8')
  }
}

async function readUsers() {
  await ensureUsersFile()
  const content = await fs.readFile(usersFile, 'utf-8')
  return JSON.parse(content)
}

async function writeUsers(users) {
  await ensureUsersFile()
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf-8')
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function createToken() {
  return crypto.randomBytes(24).toString('hex')
}

export async function registerUser({ username, password }) {
  const users = await readUsers()
  const exists = users.some((user) => user.username === username)

  if (exists) {
    throw new Error('用户名已存在')
  }

  const token = createToken()
  const newUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hashPassword(password),
    token,
    createdAt: new Date().toISOString()
  }

  users.push(newUser)
  await writeUsers(users)

  return {
    token,
    user: {
      id: newUser.id,
      username: newUser.username
    }
  }
}

export async function loginUser({ username, password }) {
  const users = await readUsers()
  const passwordHash = hashPassword(password)
  const user = users.find((item) => item.username === username && item.passwordHash === passwordHash)

  if (!user) {
    throw new Error('用户名或密码错误')
  }

  user.token = createToken()
  await writeUsers(users)

  return {
    token: user.token,
    user: {
      id: user.id,
      username: user.username
    }
  }
}

export async function getUserByToken(token) {
  if (!token) {
    return null
  }

  const users = await readUsers()
  const user = users.find((item) => item.token === token)

  if (!user) {
    return null
  }

  return {
    id: user.id,
    username: user.username
  }
}
