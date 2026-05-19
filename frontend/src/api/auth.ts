import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 60000
})

export interface AuthUser {
  id: string
  username: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export async function register(payload: { username: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/api/auth/register', payload)
  return data
}

export async function login(payload: { username: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload)
  return data
}

export async function getCurrentUser(token: string) {
  const { data } = await api.get<{ user: AuthUser }>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return data
}
