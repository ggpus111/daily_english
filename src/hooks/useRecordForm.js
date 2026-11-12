import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { session } from '../lib/storage'

const trimStrings = (form) =>
  Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  )

// 세 기록 화면이 공유하는 입력 폼 동작을 한곳에 둔다.
export function useRecordForm({ type, emptyForm, required, draftKey }) {
  const { t, notify, add, update, remove, restore } = useApp()
  const [form, setForm] = useState(() => {
    const draft = draftKey ? session.getJson(draftKey) : null
    return draft ? { ...emptyForm, ...draft } : emptyForm
  })
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const formRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (draftKey && !editingId) session.set(draftKey, JSON.stringify(form))
  }, [draftKey, editingId, form])

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev))
  }, [])

  const reset = useCallback(() => {
    setForm(emptyForm)
    setErrors({})
    setEditingId(null)
    if (draftKey) session.remove(draftKey)
  }, [draftKey, emptyForm])

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
    const { error } = editingId ? await update(type, editingId, fields) : await add(type, fields)
    savingRef.current = false
    setSaving(false)

    if (error) {
      notify(t('saveError', { message: error }))
    } else {
      reset()
      notify(t('saved'))
    }
  }

  function startEdit(item) {
    setForm(
      Object.fromEntries(
        Object.entries(emptyForm).map(([key, value]) => [key, item[key] ?? value]),
      ),
    )
    setErrors({})
    setEditingId(item.id)
    formRef.current?.scrollIntoView({ block: 'start' })
    formRef.current?.querySelector('input, textarea')?.focus({ preventScroll: true })
  }

  // 확인 창 대신 잠시 되돌릴 수 있게 한다. 실수로 지운 기록도 되살릴 수 있다.
  async function removeItem(item) {
    const { error } = await remove(type, item.id)
    if (error) {
      notify(t('deleteError', { message: error }))
      return
    }
    if (item.id === editingId) reset()
    notify(t('deleted'), {
      label: t('undo'),
      onClick: async () => {
        const result = await restore(type, item)
        notify(result.error ? t('saveError', { message: result.error }) : t('restored'))
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
    submit,
    startEdit,
    removeItem,
  }
}
