import { describe, expect, it } from 'vitest'
import { NOTES, pickNoteIndex } from './notes'

describe('pickNoteIndex', () => {
  it('바로 앞에 본 것은 어떤 난수에서도 다시 고르지 않는다', () => {
    for (let last = 0; last < 5; last++) {
      for (let step = 0; step < 100; step++) {
        const index = pickNoteIndex(5, last, () => step / 100)
        expect(index).not.toBe(last)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(5)
      }
    }
  })

  it('난수가 끝값이어도 범위를 벗어나지 않는다', () => {
    expect(pickNoteIndex(5, 4, () => 0.9999999)).toBe(3)
    expect(pickNoteIndex(5, -1, () => 0.9999999)).toBe(4)
  })

  it('앞에 본 게 없으면 모든 것이 나올 수 있다', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => pickNoteIndex(5, -1, () => i / 50)))
    expect(seen.size).toBe(5)
  })

  it('하나뿐이면 0이다', () => {
    expect(pickNoteIndex(1, 0)).toBe(0)
  })
})

describe('NOTES', () => {
  it('모두 영어와 우리말 풀이가 있고, 겹치지 않는다', () => {
    expect(NOTES.length).toBeGreaterThan(10)
    expect(new Set(NOTES.map((note) => note.en)).size).toBe(NOTES.length)
    for (const note of NOTES) {
      expect(note.en.length).toBeGreaterThan(0)
      expect(note.ko.length).toBeGreaterThan(0)
    }
  })
})
