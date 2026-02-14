import http from './http'

export function sendRegisterCodeApi(payload) {
  return http.post('/auth/register/code', payload)
}

export function loginApi(payload) {
  return http.post('/auth/login', payload)
}

export function registerApi(payload) {
  return http.post('/auth/register', payload)
}

export function refreshTokenApi(payload) {
  return http.post('/auth/refresh', payload)
}

export function logoutApi(payload) {
  return http.post('/auth/logout', payload)
}

export function getCurrentUserApi() {
  return http.get('/users/me')
}
