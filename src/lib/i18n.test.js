import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATEGORIES, STRINGS, createTranslator, languageName } from './i18n'

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.jsx?$/.test(name) && !name.includes('.test.') ? [path] : []
  })
}

describe('번역 문구', () => {
  it('한국어와 영어의 키가 같다', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.ko).sort())
  })

  it('코드에서 쓰는 키가 모두 있다', () => {
    const used = sourceFiles('src').flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/[^\w]t\('([\w.]+)'/g)].map((match) => match[1]),
    )
    expect(used.filter((key) => !(key in STRINGS.ko))).toEqual([])
    expect(CATEGORIES.filter((key) => !(`category.${key}` in STRINGS.ko))).toEqual([])
  })

  it('값을 끼워 넣고 한국어 외에는 영어를 쓴다', () => {
    expect(createTranslator('ko')('count', { count: 3 })).toBe('3개')
    expect(createTranslator('ja')('home')).toBe('Home')
    expect(createTranslator('ko')('없는키')).toBe('없는키')
  })

  it('언어 이름을 설명 언어에 맞춰 보여 준다', () => {
    expect(languageName('ja', 'ko')).toBe('일본어')
    expect(languageName('ja', 'en')).toBe('日本語')
  })
})
