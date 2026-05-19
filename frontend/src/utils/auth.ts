import type { AuthUser } from '../api/auth'

const tokenKey = 'aichat_token'
const userKey = 'aichat_user'

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(tokenKey, token)
  localStorage.setItem(userKey, JSON.stringify(user))
}

export function getToken() {
  return localStorage.getItem(tokenKey) || ''
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(userKey)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(tokenKey)
  localStorage.removeItem(userKey)
}
