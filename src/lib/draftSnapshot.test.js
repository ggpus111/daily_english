import { describe, expect, it } from 'vitest'
import { SNAPSHOT_KEYS, applySnapshot, packSnapshot, unpackSnapshot } from './draftSnapshot'

const fakeStorage = (initial = {}) => {
  const data = { ...initial }
  return {
    data,
    get: (key) => data[key] ?? null,
    set: (key, value) => {
      data[key] = value
    },
    remove: (key) => {
      delete data[key]
    },
  }
}

describe('packSnapshot', () => {
  it('저장소에 있는 세 가지를 한 글자열로 묶는다', () => {
    const store = fakeStorage({
      [SNAPSHOT_KEYS.draft]: '{"native":"새 글"}',
      [SNAPSHOT_KEYS.edit]: '{"id":"a","form":{}}',
      [SNAPSHOT_KEYS.drafts]: '[{"id":"1"}]',
    })
    expect(JSON.parse(packSnapshot(store.get))).toEqual({
      draft: '{"native":"새 글"}',
      edit: '{"id":"a","form":{}}',
      drafts: '[{"id":"1"}]',
    })
  })

  it('없는 것은 빼고, 하나도 없으면 null이다(파일을 지우라는 뜻)', () => {
    const only = fakeStorage({ [SNAPSHOT_KEYS.drafts]: '[]' })
    expect(JSON.parse(packSnapshot(only.get))).toEqual({ drafts: '[]' })
    expect(packSnapshot(fakeStorage().get)).toBeNull()
  })
})

describe('unpackSnapshot', () => {
  it('묶은 것을 그대로 풀어 준다', () => {
    const text = packSnapshot(fakeStorage({ [SNAPSHOT_KEYS.draft]: 'x', [SNAPSHOT_KEYS.edit]: 'y' }).get)
    expect(unpackSnapshot(text)).toEqual({ draft: 'x', edit: 'y' })
  })

  it('망가졌거나 형식이 다르면 null이다', () => {
    expect(unpackSnapshot('{깨짐')).toBeNull()
    expect(unpackSnapshot('"문자열"')).toBeNull()
    expect(unpackSnapshot('[1,2]')).toBeNull()
    expect(unpackSnapshot('null')).toBeNull()
  })

  it('문자열이 아닌 값은 무시한다', () => {
    expect(unpackSnapshot('{"draft":3,"edit":"ok","drafts":null}')).toEqual({ edit: 'ok' })
  })
})

describe('applySnapshot', () => {
  it('파일에 있는 것은 저장소에 쓰고, 없는 것은 저장소에서도 지운다', () => {
    const store = fakeStorage({
      [SNAPSHOT_KEYS.draft]: '{"native":""}',
      [SNAPSHOT_KEYS.edit]: '{"id":"old"}',
      [SNAPSHOT_KEYS.drafts]: '[{"id":"old"}]',
    })
    applySnapshot({ draft: '{"native":"되살린 글"}', drafts: '[{"id":"new"}]' }, store)
    expect(store.data).toEqual({
      [SNAPSHOT_KEYS.draft]: '{"native":"되살린 글"}',
      [SNAPSHOT_KEYS.drafts]: '[{"id":"new"}]',
    })
  })
})
