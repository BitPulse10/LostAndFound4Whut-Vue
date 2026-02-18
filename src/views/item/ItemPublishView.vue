<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../../layouts/AppShell.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import { addItemApi, deleteImagesApi, uploadImagesApi } from '../../services/item.api'

const router = useRouter()
const submitting = ref(false)
const uploading = ref(false)
const formError = ref('')
const formSuccess = ref('')
const fileInputRef = ref(null)

const form = ref({
  type: 1,
  eventTime: '',
  eventPlace: '',
  itemCategory: '',
  material: '',
  color: '',
  keyFeatures: '',
  identifyingMarks: '',
  supplement: '',
  cardPrimaryId: '',
  cardOwnerName: '',
  cardName: '',
  cardSupplement: '',
  tagText: '',
})

const uploadedImages = ref([])
const formModes = [
  { value: 0, label: '挂失' },
  { value: 1, label: '招领' },
  { value: 2, label: '卡证' },
]
const isCardType = computed(() => Number(form.value.type) === 2)
const normalizedCardNo = computed(() => form.value.cardPrimaryId.replace(/\s+/g, '').trim())
const autoCardTag = computed(() => {
  if (!isCardType.value || !normalizedCardNo.value) return ''
  return `priv:no=${normalizedCardNo.value}`
})
const typeLabel = computed(() => {
  if (Number(form.value.type) === 0) return '挂失'
  if (Number(form.value.type) === 2) return '卡证'
  return '招领'
})
const timeLabel = computed(() => (Number(form.value.type) === 0 ? '丢失时间（大致）' : '捡到时间'))
const placeLabel = computed(() => (Number(form.value.type) === 0 ? '丢失地点' : '捡到地点'))
const parsedTags = computed(() =>
  submitTagText.value
    .split('#')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8),
)
const structuredDescription = computed(() => {
  if (isCardType.value) {
    const lines = []
    if (form.value.cardOwnerName.trim()) lines.push(`姓名：${form.value.cardOwnerName.trim()}`)
    if (form.value.cardName.trim()) lines.push(`卡证类型：${form.value.cardName.trim()}`)
    if (form.value.cardSupplement.trim()) lines.push(`补充说明：${form.value.cardSupplement.trim()}`)
    if (!lines.length) lines.push('卡证信息')
    return lines.join('\n')
  }

  const lines = [
    `物品类别：${form.value.itemCategory.trim()}`,
    `材质：${form.value.material.trim()}`,
    `颜色：${form.value.color.trim()}`,
    `显著特征：${form.value.keyFeatures.trim()}`,
    `识别信息：${form.value.identifyingMarks.trim()}`,
  ]
  const supplement = form.value.supplement.trim()
  if (supplement) lines.push(`补充说明：${supplement}`)
  return lines.join('\n')
})
const submitTagText = computed(() => {
  const plainTagText = form.value.tagText.trim()
  if (!isCardType.value || !autoCardTag.value) return plainTagText
  if (!plainTagText) return autoCardTag.value
  return `${autoCardTag.value}#${plainTagText}`
})
const descriptionLength = computed(() => structuredDescription.value.trim().length)

const toBackendDateTime = (value) => {
  if (!value) return null
  return `${value}:00`
}

const switchFormMode = (value) => {
  form.value.type = value
  formError.value = ''
}

const triggerSelectFiles = () => {
  if (fileInputRef.value) fileInputRef.value.click()
}

const handleUploadFiles = async (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length || uploading.value) return

  uploading.value = true
  formError.value = ''
  try {
    const ids = await uploadImagesApi(files)
    const list = Array.isArray(ids) ? ids : []
    list.forEach((id, idx) => {
      const file = files[idx]
      uploadedImages.value.push({
        id,
        name: file?.name || `image-${id}`,
        previewUrl: file ? URL.createObjectURL(file) : '',
      })
    })
  } catch (error) {
    formError.value = error?.message || '图片上传失败，请稍后重试'
  } finally {
    uploading.value = false
  }
}

const removeUploadedImage = async (index) => {
  const target = uploadedImages.value[index]
  if (!target) return
  try {
    await deleteImagesApi([target.id])
  } catch {
    // 忽略删除失败，先移除前端展示
  }
  if (target.previewUrl) URL.revokeObjectURL(target.previewUrl)
  uploadedImages.value.splice(index, 1)
}

const validate = () => {
  if (![0, 1, 2].includes(Number(form.value.type))) return '物品类型不合法'
  if (!isCardType.value) {
    if (!form.value.eventTime) return `请填写${timeLabel.value}`
    if (!form.value.eventPlace.trim()) return `请填写${placeLabel.value}`
    if (!form.value.itemCategory.trim()) return '请填写物品类别'
    if (!form.value.material.trim()) return '请填写材质'
    if (!form.value.color.trim()) return '请填写颜色'
    if (!form.value.keyFeatures.trim()) return '请填写显著特征'
    if (!form.value.identifyingMarks.trim()) return '请填写识别信息'
  } else if (!form.value.cardPrimaryId.trim()) {
    return '请填写唯一编号（如学号/身份证号/工号等）'
  }

  if (descriptionLength.value > 1000) return '描述总长度不能超过1000字，请精简补充说明'
  if (uploadedImages.value.length === 0) return '请至少上传1张图片'
  return ''
}

const submitForm = async () => {
  if (submitting.value) return
  formError.value = ''
  formSuccess.value = ''

  const validationMessage = validate()
  if (validationMessage) {
    formError.value = validationMessage
    return
  }

  submitting.value = true
  try {
    await addItemApi({
      type: Number(form.value.type),
      eventTime: isCardType.value ? null : toBackendDateTime(form.value.eventTime),
      eventPlace: isCardType.value ? '' : form.value.eventPlace.trim(),
      description: structuredDescription.value.trim(),
      tagText: submitTagText.value,
      imageIds: uploadedImages.value.map((image) => image.id),
    })
    formSuccess.value = '发布成功，正在跳转到个人中心…'
    setTimeout(() => router.push('/profile'), 600)
  } catch (error) {
    formError.value = error?.message || '发布失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  uploadedImages.value.forEach((image) => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
  })
})
</script>

<template>
  <AppShell>
    <section class="publish-page">
      <SoftPanel class="publish-panel">
        <header class="hero">
          <p class="kicker">ITEM SUBMISSION</p>
          <h2>发布物品</h2>
          <div class="hero-metrics">
            <span class="chip">{{ typeLabel }}</span>
            <span class="chip">{{ uploadedImages.length }} 张图片</span>
            <span class="chip">{{ descriptionLength }}/1000 字</span>
          </div>
        </header>

        <form class="publish-form" @submit.prevent="submitForm">
          <div class="mode-switch" role="tablist" aria-label="发布表单模式">
            <button
              v-for="mode in formModes"
              :key="mode.value"
              type="button"
              class="mode-btn"
              :class="{ active: Number(form.type) === mode.value }"
              @click="switchFormMode(mode.value)"
            >
              {{ mode.label }}表单
            </button>
          </div>

          <div v-if="!isCardType" class="grid-top">
            <label class="field">
              <span>{{ timeLabel }}</span>
              <input v-model="form.eventTime" type="datetime-local" />
            </label>

            <label class="field">
              <span>{{ placeLabel }}</span>
              <input v-model="form.eventPlace" type="text" maxlength="255" placeholder="例如：南湖校区图书馆" />
            </label>
          </div>

          <div class="grid-main">
            <section v-if="!isCardType" class="desc-card">
              <p class="side-title">结构化描述（必填维度）</p>
              <div class="desc-grid">
                <label class="field">
                  <span>物品类别</span>
                  <input v-model="form.itemCategory" type="text" maxlength="40" placeholder="例如：双肩包 / 水杯 / 雨伞" />
                </label>
                <label class="field">
                  <span>材质</span>
                  <input v-model="form.material" type="text" maxlength="40" placeholder="例如：尼龙 / 不锈钢 / 塑料" />
                </label>
                <label class="field">
                  <span>颜色</span>
                  <input v-model="form.color" type="text" maxlength="40" placeholder="例如：黑色+灰色 / 蓝白拼色" />
                </label>
                <label class="field">
                  <span>显著特征</span>
                  <input v-model="form.keyFeatures" type="text" maxlength="80" placeholder="例如：前袋有校徽、侧边有磨损" />
                </label>
                <label class="field field-span-2">
                  <span>识别信息</span>
                  <input
                    v-model="form.identifyingMarks"
                    type="text"
                    maxlength="120"
                    placeholder="例如：内侧姓名贴“张三”；杯底刻字“A12”；编号后四位 2381"
                  />
                </label>
              </div>
              <label class="field">
                <span>补充说明（选填）</span>
                <textarea
                  v-model="form.supplement"
                  rows="4"
                  maxlength="500"
                  placeholder="补充时间线、丢失经过、可能位置变化等信息（可选）"
                ></textarea>
              </label>
              <div class="desc-preview">
                <p class="preview-title">自动生成的检索描述</p>
                <pre>{{ structuredDescription }}</pre>
              </div>
            </section>
            <section v-else class="desc-card">
              <p class="side-title">卡证信息（编号优先）</p>
              <div class="desc-grid">
                <label class="field field-span-2">
                  <span>唯一编号（必填）</span>
                  <input
                    v-model="form.cardPrimaryId"
                    type="text"
                    maxlength="120"
                    placeholder="填写学号 / 身份证号 / 工号 / 证件号等可唯一定位的信息"
                  />
                </label>
                <label class="field">
                  <span>姓名（选填）</span>
                  <input v-model="form.cardOwnerName" type="text" maxlength="40" placeholder="例如：张三" />
                </label>
                <label class="field">
                  <span>卡证类型（选填）</span>
                  <input v-model="form.cardName" type="text" maxlength="40" placeholder="例如：校园卡 / 身份证 / 学生证" />
                </label>
              </div>
              <label class="field">
                <span>补充说明（选填）</span>
                <textarea
                  v-model="form.cardSupplement"
                  rows="4"
                  maxlength="500"
                  placeholder="补充发证单位、证件状态、其他辅助识别信息"
                ></textarea>
              </label>
              <div class="desc-preview">
                <p class="preview-title">自动生成的检索描述</p>
                <pre>{{ structuredDescription }}</pre>
              </div>
            </section>

            <aside class="side-card">
              <p class="side-title">标签预览</p>
              <p v-if="isCardType" class="muted">
                卡号标签（系统自动）：<code>{{ autoCardTag || '请先填写唯一编号' }}</code>
              </p>
              <label class="field compact">
                <span>标签文本（#分隔）</span>
                <input v-model="form.tagText" type="text" placeholder="#黑色背包#钥匙#水杯" />
              </label>
              <div class="tag-preview" v-if="parsedTags.length">
                <span v-for="tag in parsedTags" :key="`tag-${tag}`" class="tag">#{{ tag }}</span>
              </div>
              <p v-else class="muted">输入 <code>#标签</code> 后会在这里预览</p>
            </aside>
          </div>

          <section class="upload-block">
            <div class="upload-head">
              <div>
                <p class="side-title">图片素材</p>
                <p class="muted">至少 1 张，建议 3-5 张可提升检索效果</p>
              </div>
              <button type="button" class="btn ghost" :disabled="uploading" @click="triggerSelectFiles">
                {{ uploading ? '上传中…' : '选择并上传图片' }}
              </button>
              <input ref="fileInputRef" class="hidden" type="file" accept="image/*" multiple @change="handleUploadFiles" />
            </div>
            <ul v-if="uploadedImages.length" class="image-list">
              <li v-for="(image, index) in uploadedImages" :key="`uploaded-${image.id}-${index}`">
                <img v-if="image.previewUrl" :src="image.previewUrl" alt="预览图" />
                <div class="meta">
                  <p class="name" :title="image.name">{{ image.name }}</p>
                  <p class="id">ID: {{ image.id }}</p>
                </div>
                <button type="button" class="remove" @click="removeUploadedImage(index)">移除</button>
              </li>
            </ul>
            <p v-else class="empty-upload">还没有上传图片</p>
          </section>

          <p v-if="formError" class="error">{{ formError }}</p>
          <p v-if="formSuccess" class="success">{{ formSuccess }}</p>

          <div class="actions">
            <button class="btn primary" type="submit" :disabled="submitting">
              {{ submitting ? '提交中…' : '发布到广场' }}
            </button>
          </div>
        </form>
      </SoftPanel>
    </section>
  </AppShell>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap');

.publish-page {
  display: grid;
  padding-bottom: 3rem;
}

.publish-panel {
  --ink: #0f172a;
  --deep: #0f3a83;
  --line: #d5dfef;
  --soft-line: #e8eef8;
  --paper: #f7faff;
  --focus: rgba(37, 99, 235, 0.22);
  max-width: 1040px;
  padding: clamp(1.15rem, 2.3vw, 2rem);
  border: 1px solid #dce5f3;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.1);
  font-family: 'Noto Sans SC', sans-serif;
}

.hero {
  border-bottom: 1px solid var(--soft-line);
  padding-bottom: 1.4rem;
}

.kicker {
  margin: 0;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: #5b78a9;
}

.hero h2 {
  margin: 0.32rem 0 0.4rem;
  font-size: clamp(2rem, 3.1vw, 2.5rem);
  line-height: 1.15;
  color: var(--deep);
  letter-spacing: -0.015em;
}

.sub {
  margin: 0;
  max-width: 60ch;
  color: #536680;
  font-size: 0.95rem;
  line-height: 1.6;
}

.hero code {
  color: #1e40af;
  font-weight: 600;
}

.hero-metrics {
  margin-top: 1rem;
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

.publish-form {
  margin-top: 1.5rem;
  display: grid;
  gap: 1.2rem;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.mode-btn {
  border: 1px solid #d4e0f2;
  border-radius: 12px;
  background: #f8fbff;
  color: #335a8f;
  padding: 0.66rem 0.75rem;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.mode-btn:hover {
  border-color: #b9cdec;
}

.mode-btn.active {
  border-color: #1f5fc2;
  background: #eaf2ff;
  color: #14449a;
  box-shadow: 0 8px 20px rgba(31, 95, 194, 0.12);
}

.grid-top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  border-radius: 16px;
  background: rgba(248, 251, 255, 0.9);
  border: 1px solid var(--soft-line);
}

.field-wide {
  grid-column: 1 / -1;
}

.grid-main {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1rem;
}

.desc-card {
  border: 1px solid var(--soft-line);
  border-radius: 16px;
  padding: 1rem;
  background: rgba(248, 251, 255, 0.95);
  display: grid;
  gap: 0.9rem;
}

.desc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.72rem;
}

.field-span-2 {
  grid-column: 1 / -1;
}

.desc-preview {
  border: 1px solid #dce6f5;
  background: #ffffff;
  border-radius: 14px;
  padding: 0.8rem;
}

.preview-title {
  margin: 0;
  color: #26466f;
  font-size: 0.82rem;
  font-weight: 600;
}

.desc-preview pre {
  margin: 0.5rem 0 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #1f334f;
}

.side-card {
  border: 1px solid var(--soft-line);
  border-radius: 16px;
  padding: 1rem;
  background: rgba(248, 251, 255, 0.95);
}

.side-title {
  margin: 0 0 0.65rem;
  font-weight: 700;
  font-size: 0.94rem;
  color: #173763;
}

.compact {
  gap: 0.45rem;
}

.tag-preview {
  margin-top: 0.7rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  border: 1px solid #c7d8f6;
  background: #eef5ff;
  border-radius: 999px;
  padding: 0.22rem 0.66rem;
  font-size: 0.78rem;
  color: #1e3a8a;
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

.field {
  display: grid;
  gap: 0.5rem;
}

.field > span {
  font-size: 0.82rem;
  color: #2f4e79;
  font-weight: 600;
  letter-spacing: 0.01em;
}

input,
select,
textarea {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  padding: 0.78rem 0.8rem;
  font: inherit;
  color: var(--ink);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
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

.image-list img {
  width: 78px;
  height: 78px;
  object-fit: cover;
  border-radius: 12px;
  background: #dbe5f5;
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
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(20, 48, 93, 0.14);
  border-color: #204b90;
}

.btn.ghost {
  border-color: #d2def0;
  color: #26466f;
  background: #ffffff;
}

.btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.primary {
  border-color: #1247a4;
  background: #1f5fc2;
  color: #fff;
  min-width: 180px;
  padding-left: 1.2rem;
  padding-right: 1.2rem;
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

.actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--soft-line);
  padding-top: 1rem;
}

.muted {
  margin: 0;
  color: #667991;
  font-size: 0.82rem;
  line-height: 1.55;
}

.muted code {
  font-size: 0.78rem;
  color: #1e40af;
}

.empty-upload {
  margin: 0.8rem 0 0;
  color: #667991;
  font-size: 0.84rem;
}

@media (max-width: 900px) {
  .mode-switch {
    grid-template-columns: 1fr;
  }

  .grid-top,
  .grid-main {
    grid-template-columns: 1fr;
  }

  .desc-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }

  .field-wide {
    grid-column: auto;
  }

  .publish-form {
    gap: 1rem;
  }

  .actions {
    justify-content: stretch;
  }

  .actions .primary {
    width: 100%;
  }
}
</style>
