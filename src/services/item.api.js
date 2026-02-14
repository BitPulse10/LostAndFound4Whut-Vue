import http from './http'

export function filterItemsApi(payload) {
  return http.post('/items/filter', payload)
}

export function getItemByIdApi(itemId) {
  return http.get(`/items/${itemId}`)
}

export function getItemDetailByIdApi(itemId) {
  return http.get(`/items/${itemId}/detail`)
}

export function recognizeImageTagsApi(file) {
  const form = new FormData()
  form.append('file', file)
  return http.post('/images/recognize/tabs', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getImageUrlApi(imageId) {
  return http.get(`/images/url/${imageId}`)
}
