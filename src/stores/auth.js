import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getCurrentUserApi,
  loginApi,
  logoutApi,
  registerApi,
  sendRegisterCodeApi,
} from '../services/auth.api'

const TOKEN_KEY = 'laf_token'
const REFRESH_TOKEN_KEY = 'laf_refresh_token'
const USER_KEY = 'laf_user'

function readUser() {
  const cache = sessionStorage.getItem(USER_KEY)
  if (!cache) return null
  try {
    return JSON.parse(cache)
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(sessionStorage.getItem(TOKEN_KEY) || '')
  const refreshToken = ref(sessionStorage.getItem(REFRESH_TOKEN_KEY) || '')
  const user = ref(readUser())
  const loading = ref(false)
  const codeSending = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))

  const setAuthState = ({ newToken = '', newRefreshToken = '', newUser = null }) => {
    token.value = newToken
    refreshToken.value = newRefreshToken
    user.value = newUser

    if (newToken) {
      sessionStorage.setItem(TOKEN_KEY, newToken)
    } else {
      sessionStorage.removeItem(TOKEN_KEY)
    }

    if (newRefreshToken) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    }

    if (newUser) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(newUser))
    } else {
      sessionStorage.removeItem(USER_KEY)
    }
  }

  const login = async (payload) => {
    loading.value = true
    try {
      const data = await loginApi(payload)
      setAuthState({
        newToken: data?.token || '',
        newRefreshToken: data?.refreshToken || '',
        newUser: data,
      })
      return data
    } finally {
      loading.value = false
    }
  }

  const register = async (payload) => {
    loading.value = true
    try {
      return await registerApi(payload)
    } finally {
      loading.value = false
    }
  }

  const sendRegisterCode = async (email) => {
    codeSending.value = true
    try {
      return await sendRegisterCodeApi({ email })
    } finally {
      codeSending.value = false
    }
  }

  const fetchCurrentUser = async () => {
    if (!token.value) return null
    const profile = await getCurrentUserApi()
    setAuthState({
      newToken: token.value,
      newRefreshToken: refreshToken.value,
      newUser: profile,
    })
    return profile
  }

  const logout = async () => {
    const currentRefreshToken = refreshToken.value
    if (currentRefreshToken) {
      try {
        await logoutApi({ refreshToken: currentRefreshToken })
      } catch {
        // Ignore logout API error and clear local state.
      }
    }
    setAuthState({ newToken: '', newRefreshToken: '', newUser: null })
  }

  return {
    token,
    refreshToken,
    user,
    loading,
    codeSending,
    isLoggedIn,
    login,
    register,
    sendRegisterCode,
    fetchCurrentUser,
    logout,
  }
})
