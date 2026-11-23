import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { local } from '../lib/storage'

const trimStrings = (form) =>
  Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  )

// 세 기록 화면이 공유하는 입력 폼 동작을 한곳에 둔다.
export function useRecordForm({ type, emptyForm, required, draftKey }) {
  const { t, notify, add, update, remove, restore } = useApp()
  // 쓰던 내용은 기기 저장소에 둔다. 안드로이드가 다른 앱에 간 사이 앱을 꺼도(메모리 부족),
  // 다른 탭에 갔다 와도 남아 있게. 새로 쓰던 것과 고치던 것은 따로 둔다.
  const editKey = draftKey ? `${draftKey}Edit` : null
  const [restored] = useState(() => {
    const editDraft = editKey ? local.getJson(editKey) : null
    if (editDraft?.id && editDraft.form) return { editingId: editDraft.id, form: { ...emptyForm, ...editDraft.form } }
    const draft = draftKey ? local.getJson(draftKey) : null
    return { editingId: null, form: draft ? { ...emptyForm, ...draft } : emptyForm }
  })
  const [form, setForm] = useState(restored.form)
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(restored.editingId)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const formRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!draftKey) return
    if (editingId) local.set(editKey, JSON.stringify({ id: editingId, form }))
    else local.set(draftKey, JSON.stringify(form))
  }, [draftKey, editKey, editingId, form])

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev))
  }, [])

  const reset = useCallback(() => {
    setForm(emptyForm)
    setErrors({})
    setEditingId(null)
    if (draftKey) {
      local.remove(draftKey)
      local.remove(editKey)
    }
  }, [draftKey, editKey, emptyForm])

  // 임시저장함에서 꺼낸 내용처럼, 폼을 통째로 다른 내용으로 바꾼다(고치던 중이 아닌 새 글로).
  const loadForm = useCallback(
    (next) => {
      setForm({ ...emptyForm, ...next })
      setErrors({})
      setEditingId(null)
      if (editKey) local.remove(editKey)
    },
    [editKey, emptyForm],
  )

  async function submit(event) {
    event.preventDefault()
    if (savingRef.current) return

    const fields = trimStrings(form)
    const missing = required.filter((field) => !fields[field])
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((field) => [field, t('fieldRequired')])))
      formRef.current?.querySelector(`[name="${missing[0]}"]`)?.focus()
      return
    }

    savingRef.current = true
    setSaving(true)
    const { error, queued } = editingId ? await update(type, editingId, fields) : await add(type, fields)
    savingRef.current = false
    setSaving(false)

    if (error) {
      notify(t('saveError', { message: errorMessage(error, t) }))
    } else {
      reset()
      notify(t(queued ? 'savedOffline' : 'saved'))
    }
  }

  function startEdit(item) {
    setForm(Object.fromEntries(Object.entries(emptyForm).map(([key, value]) => [key, item[key] ?? value])))
    setErrors({})
    setEditingId(item.id)
    formRef.current?.scrollIntoView({ block: 'start' })
    formRef.current?.querySelector('input, textarea')?.focus({ preventScroll: true })
  }

  // 확인 창 대신 잠시 되돌릴 수 있게 한다. 실수로 지운 기록도 되살릴 수 있다.
  async function removeItem(item) {
    const { error, queued } = await remove(type, item.id)
    if (error) {
      notify(t('deleteError', { message: errorMessage(error, t) }))
      return
    }
    if (item.id === editingId) reset()
    notify(t(queued ? 'deletedOffline' : 'deleted'), {
      label: t('undo'),
      onClick: async () => {
        const result = await restore(type, item)
        notify(result.error ? t('saveError', { message: errorMessage(result.error, t) }) : t('restored'))
      },
    })
    listRef.current?.focus()
  }

  return {
    form,
    errors,
    editingId,
    saving,
    formRef,
    listRef,
    setField,
    reset,
    loadForm,
    submit,
    startEdit,
    removeItem,
  }
}
