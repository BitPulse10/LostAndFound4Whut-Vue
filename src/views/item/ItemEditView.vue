<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../../layouts/AppShell.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import {
  deleteImagesApi,
  getImageIdsByItemIdApi,
  getImageUrlApi,
  getItemDetailByIdApi,
  updateItemApi,
  uploadImagesApi,
} from '../../services/item.api'

const router = useRouter()
const route = useRoute()
const itemId = Number(route.params.id)

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const success = ref('')
const fileInputRef = ref(null)

const form = ref({
  type: 1,
  eventTime: '',
  eventPlace: '',
  description: '',
  tagText: '',
  cardPrimaryId: '',
})

const images = ref([])

const isCardType = computed(() => Number(form.value.type) === 2)
const descriptionLength = computed(() => form.value.description.trim().length)
const normalizedCardNo = computed(() => form.value.cardPrimaryId.replace(/\s+/g, '').trim())
const autoCardTag = computed(() => {
  if (!isCardType.value || !normalizedCardNo.value) return ''
  return `priv:no=${normalizedCardNo.value}`
})
const submitTagText = computed(() => {
  const plainTagText = form.value.tagText.trim()
  if (!isCardType.value || !autoCardTag.value) return plainTagText
  if (!plainTagText) return autoCardTag.value
  return `${autoCardTag.value}#${plainTagText}`
})

const toInputDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toBackendDateTime = (value) => {
  if (!value) return null
  return `${value}:00`
}

const normalizeDetailImageUrl = (value) => {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  const lower = raw.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('/dev-local-images/')) {
    return raw
  }
  if (lower.startsWith('file://')) {
    const localPath = raw.replace(/^file:\/+/, '').replace(/\\/g, '/')
    return `/dev-local-images/${encodeURI(localPath)}`
  }
  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    const localPath = raw.replace(/\\/g, '/')
    return `/dev-local-images/${encodeURI(localPath)}`
  }
  return ''
}

const buildEditImageAlt = (image, index) => {
  const name = typeof image?.name === 'string' && image.name.trim() ? image.name.trim() : `图片${index + 1}`
  const idText = Number.isFinite(Number(image?.id)) ? `（ID ${image.id}）` : ''
  return `帖子编辑图片：${name}${idText}`
}

const loadItem = async () => {
  if (!Number.isFinite(itemId) || itemId <= 0) {
    error.value = '帖子ID无效'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const [detail, imageIds] = await Promise.all([getItemDetailByIdApi(itemId), getImageIdsByItemIdApi(itemId)])
    form.value.type = Number(detail?.type ?? 1)
    form.value.eventTime = toInputDateTime(detail?.eventTime)
    form.value.eventPlace = detail?.eventPlace || ''
    form.value.description = detail?.description || ''
    form.value.tagText = Array.isArray(detail?.tags) ? detail.tags.join('#') : ''
    form.value.cardPrimaryId = ''

    const ids = Array.isArray(imageIds) ? imageIds : []
    const urls = Array.isArray(detail?.imageUrls) ? detail.imageUrls.map(normalizeDetailImageUrl) : []
    images.value = ids.map((id, index) => ({
      id,
      name: `image-${id}`,
      previewUrl: urls[index] || '',
      isLocalPreview: false,
    }))
  } catch (e) {
    error.value = e?.message || '加载帖子失败'
  } finally {
    loading.value = false
  }
}

const triggerSelectFiles = () => {
  if (fileInputRef.value) fileInputRef.value.click()
}

const handleUploadFiles = async (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length || uploading.value) return

  uploading.value = true
  error.value = ''
  try {
    const uploadedIds = await uploadImagesApi(files)
    const ids = Array.isArray(uploadedIds) ? uploadedIds : []
    const merged = [...images.value]
    await Promise.all(
      ids.map(async (id, idx) => {
        let previewUrl = ''
        try {
          previewUrl = await getImageUrlApi(id)
        } catch {
          previewUrl = files[idx] ? URL.createObjectURL(files[idx]) : ''
        }
        merged.push({
          id,
          name: files[idx]?.name || `image-${id}`,
          previewUrl,
          isLocalPreview: !previewUrl.startsWith('http') && !previewUrl.startsWith('/dev-local-images/'),
        })
      }),
    )
    images.value = merged
  } catch (e) {
    error.value = e?.message || '上传图片失败'
  } finally {
    uploading.value = false
  }
}

const removeImage = async (index) => {
  const target = images.value[index]
  if (!target) return
  const confirmed = window.confirm('确认移除这张图片吗？')
  if (!confirmed) return
  try {
    await deleteImagesApi([target.id])
  } catch {
    // ignore
  }
  if (target.isLocalPreview && target.previewUrl) {
    URL.revokeObjectURL(target.previewUrl)
  }
  images.value.splice(index, 1)
}

const validate = () => {
  if (![0, 1, 2].includes(Number(form.value.type))) return '物品类型不合法'
  if (!isCardType.value) {
    if (!form.value.eventTime) return '请填写时间'
    if (!form.value.eventPlace.trim()) return '请填写地点'
  }
  if (!form.value.description.trim()) return '请填写描述'
  if (isCardType.value && !normalizedCardNo.value) return '卡证帖子请填写唯一编号，避免检索失效'
  if (descriptionLength.value > 1000) return '描述不能超过1000字'
  if (!images.value.length) return '请至少保留1张图片'
  return ''
}

const submitForm = async () => {
  if (saving.value) return
  error.value = ''
  success.value = ''
  const validationMessage = validate()
  if (validationMessage) {
    error.value = validationMessage
    return
  }

  saving.value = true
  try {
    await updateItemApi(itemId, {
      type: Number(form.value.type),
      eventTime: isCardType.value ? null : toBackendDateTime(form.value.eventTime),
      eventPlace: isCardType.value ? '' : form.value.eventPlace.trim(),
      description: form.value.description.trim(),
      tagText: submitTagText.value,
      imageIds: images.value.map((image) => image.id),
    })
    success.value = '更新成功，正在返回个人中心…'
    setTimeout(() => router.push('/profile'), 600)
  } catch (e) {
    error.value = e?.message || '更新失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadItem()
})

onBeforeUnmount(() => {
  images.value.forEach((image) => {
    if (image.isLocalPreview && image.previewUrl) {
      URL.revokeObjectURL(image.previewUrl)
    }
  })
})
</script>

<template>
  <AppShell>
    <section class="edit-page">
      <SoftPanel class="edit-panel">
        <header class="hero">
          <p class="kicker">ITEM EDIT</p>
          <h2>重新编辑帖子</h2>
          <div class="hero-metrics">
            <span class="chip">ID {{ itemId }}</span>
            <span class="chip">{{ images.length }} 张图片</span>
            <span class="chip">{{ descriptionLength }}/1000 字</span>
          </div>
        </header>

        <p v-if="loading" class="muted">正在加载帖子数据…</p>
        <p v-else-if="error && !images.length && !form.description" class="error">{{ error }}</p>

        <form v-else class="edit-form" @submit.prevent="submitForm">
          <div class="grid-top">
            <label class="field">
              <span>帖子类型</span>
              <select v-model.number="form.type">
                <option :value="0">挂失</option>
                <option :value="1">招领</option>
                <option :value="2">卡证</option>
              </select>
            </label>

            <label class="field" v-if="!isCardType">
              <span>事件时间</span>
              <input v-model="form.eventTime" type="datetime-local" />
            </label>

            <label class="field" v-if="!isCardType">
              <span>事件地点</span>
              <input v-model="form.eventPlace" type="text" maxlength="255" placeholder="例如：南湖校区图书馆" />
            </label>
          </div>

          <label class="field">
            <span>描述</span>
            <textarea
              v-model="form.description"
              rows="8"
              maxlength="1000"
              placeholder="请填写可用于检索的完整描述"
            ></textarea>
          </label>

          <label v-if="isCardType" class="field">
            <span>卡证唯一编号</span>
            <input
              v-model="form.cardPrimaryId"
              type="text"
              maxlength="120"
              placeholder="填写学号/身份证号/工号等唯一编号"
            />
            <small class="muted">用于卡证检索，若不填写将无法稳定命中；此值会按私密标签存储。</small>
          </label>

          <label class="field">
            <span>标签（# 分隔）</span>
            <input
              v-model="form.tagText"
              type="text"
              maxlength="300"
              placeholder="#黑色#鼠标#英菲克"
            />
            <small v-if="isCardType && autoCardTag" class="muted">自动追加私密标签：{{ autoCardTag }}</small>
          </label>

          <section class="upload-block">
            <div class="upload-head">
              <div>
                <p class="side-title">图片素材</p>
                <p class="muted">至少保留1张图片</p>
              </div>
              <button type="button" class="btn ghost" :disabled="uploading" @click="triggerSelectFiles">
                {{ uploading ? '上传中…' : '添加图片' }}
              </button>
              <input ref="fileInputRef" class="hidden" type="file" accept="image/*" multiple @change="handleUploadFiles" />
            </div>

            <ul v-if="images.length" class="image-list">
              <li v-for="(image, index) in images" :key="`edit-image-${image.id}-${index}`">
                <img v-if="image.previewUrl" :src="image.previewUrl" :alt="buildEditImageAlt(image, index)" />
                <div v-else class="img-empty">暂无预览</div>
                <div class="meta">
                  <p class="name" :title="image.name">{{ image.name }}</p>
                  <p class="id">ID: {{ image.id }}</p>
                </div>
                <button type="button" class="remove" @click="removeImage(index)">移除</button>
              </li>
            </ul>
            <p v-else class="empty-upload">还没有图片</p>
          </section>

          <p v-if="error" class="error">{{ error }}</p>
          <p v-if="success" class="success">{{ success }}</p>

          <div class="actions">
            <button type="button" class="btn ghost" @click="router.push('/profile')">取消</button>
            <button class="btn primary" type="submit" :disabled="saving">
              {{ saving ? '保存中…' : '保存修改' }}
            </button>
          </div>
        </form>
      </SoftPanel>
    </section>
  </AppShell>
</template>

<style scoped>
.edit-page {
  display: grid;
  padding-bottom: 3rem;
}

.edit-panel {
  --ink: #0f172a;
  --deep: #0f3a83;
  --line: #d5dfef;
  --soft-line: #e8eef8;
  --paper: #f7faff;
  --focus: rgba(37, 99, 235, 0.22);
  max-width: 960px;
  padding: clamp(1.15rem, 2.3vw, 2rem);
  border: 1px solid #dce5f3;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.1);
}

.hero {
  border-bottom: 1px solid var(--soft-line);
  padding-bottom: 1.2rem;
}

.kicker {
  margin: 0;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: #5b78a9;
}

.hero h2 {
  margin: 0.32rem 0 0.4rem;
  font-size: clamp(1.8rem, 2.8vw, 2.3rem);
  line-height: 1.15;
  color: var(--deep);
}

.hero-metrics {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.58rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid #d6e1f3;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  padding: 0.26rem 0.72rem;
  color: #2d4c77;
  font-size: 0.78rem;
}

.edit-form {
  margin-top: 1.2rem;
  display: grid;
  gap: 1rem;
}

.grid-top {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.8rem;
}

.field {
  display: grid;
  gap: 0.46rem;
}

.field > span {
  font-size: 0.82rem;
  color: #2f4e79;
  font-weight: 600;
}

input,
select,
textarea {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  padding: 0.72rem 0.8rem;
  font: inherit;
  color: var(--ink);
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: none;
  border-color: #4a71bc;
  box-shadow: 0 0 0 4px var(--focus);
}

textarea {
  resize: vertical;
  min-height: 130px;
  line-height: 1.55;
}

.upload-block {
  border: 1px solid var(--soft-line);
  border-radius: 16px;
  background: rgba(248, 251, 255, 0.95);
  padding: 1rem;
}

.upload-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.side-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.94rem;
  color: #173763;
}

.hidden {
  display: none;
}

.image-list {
  list-style: none;
  margin: 0.95rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.image-list li {
  border: 1px solid #dce5f3;
  border-radius: 14px;
  padding: 0.65rem;
  display: grid;
  grid-template-columns: 78px 1fr auto;
  align-items: center;
  gap: 0.7rem;
  background: #ffffff;
}

.image-list img,
.img-empty {
  width: 78px;
  height: 78px;
  border-radius: 12px;
  background: #dbe5f5;
  object-fit: cover;
}

.img-empty {
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  color: #64748b;
}

.name {
  margin: 0;
  color: #223654;
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id {
  margin: 0.28rem 0 0;
  color: #677891;
  font-size: 0.74rem;
}

.btn {
  border: 1px solid #365d9f;
  background: #ffffff;
  color: #1e3f6e;
  border-radius: 999px;
  padding: 0.5rem 1.02rem;
  cursor: pointer;
  font-weight: 600;
}

.btn.ghost {
  border-color: #d2def0;
  color: #26466f;
}

.primary {
  border-color: #1247a4;
  background: #1f5fc2;
  color: #fff;
}

.btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.remove {
  border: 1px solid #d8e1f0;
  background: #f7fafe;
  color: #435f84;
  border-radius: 999px;
  padding: 0.28rem 0.66rem;
  cursor: pointer;
  font-size: 0.74rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  border-top: 1px solid var(--soft-line);
  padding-top: 1rem;
}

.muted {
  margin: 0;
  color: #667991;
  font-size: 0.82rem;
}

.empty-upload {
  margin: 0.8rem 0 0;
  color: #667991;
  font-size: 0.84rem;
}

.error {
  margin: 0;
  color: #991b1b;
  font-weight: 600;
}

.success {
  margin: 0;
  color: #0f766e;
  font-weight: 600;
}

@media (max-width: 900px) {
  .grid-top {
    grid-template-columns: 1fr;
  }
}
</style>
