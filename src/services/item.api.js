import http from './http'

export function filterItemsApi(payload) {
  return http.post('/items/filter', payload)
}

export function addItemApi(payload) {
  return http.post('/items/add-item', payload)
}

export function uploadImagesApi(files) {
  const form = new FormData()
  for (const file of files || []) {
    form.append('files', file)
  }
  return http.post('/images/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
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

export function listMyItemsApi(params) {
  return http.get('/items/me', { params })
}

export function closeItemApi(itemId) {
  return http.put(
    '/items/update-item',
    { status: 1 },
    {
      params: { itemId },
    },
  )
}

export function takeDownItemApi(itemId) {
  return http.put('/items/take-down', null, {
    params: { itemId },
  })
}

export function deleteImagesApi(imageIds) {
  return http.delete('/items/images', { data: imageIds })
}
