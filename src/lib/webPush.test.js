import { describe, expect, it } from 'vitest'
import { keyToBytes, toQueueRows } from './webPush'

const t = (key, values = {}) => `${key}:${values.count ?? ''}`

describe('웹 푸시', () => {
  it('base64url 공개 키를 바이트로 바꾼다(= 채우기, -_ 바꾸기)', () => {
    const bytes = keyToBytes('AQID-_8')
    expect([...bytes]).toEqual([1, 2, 3, 251, 255])
  })

  it('알림 계획을 서버 대기열 행으로 바꾸고, 누르면 열 화면을 정한다', () => {
    const at = new Date('2026-11-20T04:00:00Z')
    const rows = toQueueRows(
      [
        { id: 1, kind: 'goal', at, count: 3 },
        { id: 2, kind: 'review', at, count: 7 },
      ],
      t,
    )
    expect(rows).toEqual([
      { send_at: '2026-11-20T04:00:00.000Z', kind: 'goal', title: 'reminderGoalTitle:', body: 'reminderGoalBody:3', url: '/#journal' },
      { send_at: '2026-11-20T04:00:00.000Z', kind: 'review', title: 'reminderReviewTitle:', body: 'reminderReviewBody:7', url: '/#words' },
    ])
  })
})
