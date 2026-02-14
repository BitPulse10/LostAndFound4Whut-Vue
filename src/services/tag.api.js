import http from './http'

export function listTagsApi(params = {}) {
  return http.get('/tags', { params })
}
