import axios from 'axios'

const TOKEN_KEY = 'laf_token'
const REFRESH_TOKEN_KEY = 'laf_refresh_token'
const SUCCESS_CODE = '0000'
const NOT_LOGIN_CODE = '0003'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})
let refreshPromise = null

const clearAuthState = () => {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem('laf_user')
}

const redirectToLogin = () => {
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

const isAuthFailure = (errorOrResponse) => {
  const status = errorOrResponse?.response?.status ?? errorOrResponse?.status
  const code = errorOrResponse?.response?.data?.code ?? errorOrResponse?.data?.code
  return status === 401 || status === 403 || code === NOT_LOGIN_CODE
}

const performTokenRefresh = async () => {
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  const refreshResponse = await refreshClient.post('/auth/refresh', { refreshToken })
  const refreshBody = refreshResponse?.data
  if (!refreshBody || refreshBody.code !== SUCCESS_CODE) {
    throw new Error(refreshBody?.info || 'Refresh token invalid')
  }

  const nextToken = refreshBody.data?.token
  const nextRefreshToken = refreshBody.data?.refreshToken
  if (nextToken) {
    sessionStorage.setItem(TOKEN_KEY, nextToken)
  }
  if (nextRefreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken)
  }
  return nextToken || null
}

const tryRefreshAndReplay = async (originalConfig) => {
  if (originalConfig?._retry) return null

  originalConfig._retry = true
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null
    })
  }

  const nextToken = await refreshPromise
  if (!nextToken) return null
  originalConfig.headers = originalConfig.headers || {}
  originalConfig.headers.Authorization = `Bearer ${nextToken}`
  return http(originalConfig)
}

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  async (response) => {
    const body = response?.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === NOT_LOGIN_CODE) {
        try {
          const replay = await tryRefreshAndReplay(response.config || {})
          if (replay) {
            return replay
          }
        } catch {
          // fall through to clear auth state
        }
        clearAuthState()
        redirectToLogin()
      }

      if (body.code !== SUCCESS_CODE) {
        const bizError = new Error(body.info || 'Request failed')
        bizError.name = 'BizError'
        bizError.response = response
        throw bizError
      }
      return body.data
    }

    return body
  },
  async (error) => {
    const original = error.config || {}
    const authFailed = isAuthFailure(error)

    if (authFailed) {
      try {
        const replay = await tryRefreshAndReplay(original)
        if (replay) {
          return replay
        }
      } catch {
        // fall through to clear auth state
      }
      clearAuthState()
      redirectToLogin()
    }

    if (error?.response?.data?.info && !error.message) {
      error.message = error.response.data.info
    }

    throw error
  },
)

export default http
