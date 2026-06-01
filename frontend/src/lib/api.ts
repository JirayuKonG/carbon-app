import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { formatFriendlyErrorMessage } from '@/lib/friendly-text'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — unwrap data / handle errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = formatFriendlyErrorMessage(err.response?.data ?? err.message)
    return Promise.reject(new Error(message))
  },
)

// Generic helpers
export const get  = <T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig) =>
  api.get<T>(url, { ...config, params }).then((r) => r.data)

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.post<T>(url, data, config).then((r) => r.data)

export const put  = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  api.put<T>(url, data, config).then((r) => r.data)

export const del  = <T>(url: string, config?: AxiosRequestConfig) =>
  api.delete<T>(url, config).then((r) => r.data)
