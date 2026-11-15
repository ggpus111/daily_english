// 이번 주 돌아보기를 이미지(1080×1350, 세로형)로 그린다. 앱의 색 토큰을 읽어 같은 느낌으로 만든다.

export const RECAP_SIZE = { width: 1080, height: 1350 }

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ title: string, range: string, stats: Array<{label: string, value: number}>, usedTitle: string, used: string[],
 *   usedEmpty: string, moodTitle: string, moods: Array<{day: string, mood: string, tone: string}>, moodEmpty: string, footer: string }} data
 */
export function drawRecap(ctx, data) {
  const { width, height } = RECAP_SIZE
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const colors = {
    bg: token('--bg', '#f4f0eb'),
    surface: token('--surface', '#fcfaf7'),
    ink: token('--ink', '#3a2b22'),
    sub: token('--sub', '#6b5a50'),
    accent: token('--accent', '#d39a85'),
    soft: token('--accent-soft', '#f3e1d8'),
    accentInk: token('--accent-ink', '#a8492c'),
    pastels: [token('--peach', '#e8cfc2'), token('--lilac', '#dcd9e2'), token('--sage', '#d8ded4'), token('--butter', '#ebe3cf')],
    cardInk: token('--card-ink', '#4a3f38'),
  }

  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, width, height)
  roundRect(ctx, 60, 60, width - 120, height - 120, 48, colors.surface)

  const left = 120
  ctx.textBaseline = 'top'
  ctx.fillStyle = colors.accentInk
  ctx.font = `700 30px ${font}`
  ctx.fillText('THIS WEEK', left, 130)
  ctx.fillStyle = colors.ink
  ctx.font = `800 64px ${font}`
  ctx.fillText(data.title, left, 175)
  ctx.fillStyle = colors.sub
  ctx.font = `500 32px ${font}`
  ctx.fillText(data.range, left, 260)

  // 숫자 네 칸
  const boxWidth = (width - 240 - 3 * 24) / 4
  data.stats.forEach((stat, index) => {
    const x = left + index * (boxWidth + 24)
    roundRect(ctx, x, 340, boxWidth, 190, 28, colors.pastels[index % 4])
    ctx.fillStyle = colors.cardInk
    ctx.font = `800 72px ${font}`
    ctx.fillText(String(stat.value), x + 28, 375)
    ctx.font = `600 28px ${font}`
    ctx.fillText(stat.label, x + 28, 470)
  })

  // 일기에 쓴 내 표현
  let y = 590
  ctx.fillStyle = colors.ink
  ctx.font = `800 38px ${font}`
  ctx.fillText(data.usedTitle, left, y)
  y += 70
  ctx.font = `700 34px ${font}`
  if (data.used.length === 0) {
    ctx.fillStyle = colors.sub
    ctx.font = `500 30px ${font}`
    ctx.fillText(data.usedEmpty, left, y)
    y += 60
  } else {
    let x = left
    for (const text of data.used.slice(0, 10)) {
      const chipWidth = ctx.measureText(text).width + 48
      if (x + chipWidth > width - 120) {
        x = left
        y += 76
      }
      if (y > 930) break
      roundRect(ctx, x, y, chipWidth, 60, 30, colors.soft)
      ctx.fillStyle = colors.accentInk
      ctx.fillText(text, x + 24, y + 12)
      x += chipWidth + 14
    }
    y += 100
  }

  // 이번 주 기분
  y = Math.max(y, 860)
  ctx.fillStyle = colors.ink
  ctx.font = `800 38px ${font}`
  ctx.fillText(data.moodTitle, left, y)
  y += 70
  if (data.moods.length === 0) {
    ctx.fillStyle = colors.sub
    ctx.font = `500 30px ${font}`
    ctx.fillText(data.moodEmpty, left, y)
  } else {
    let x = left
    const toneColor = { good: colors.pastels[3], low: colors.pastels[1], plain: colors.pastels[2] }
    for (const { day, mood, tone } of data.moods.slice(0, 7)) {
      ctx.font = `600 26px ${font}`
      const dayWidth = ctx.measureText(day).width
      ctx.font = `700 34px ${font}`
      const moodWidth = ctx.measureText(mood).width
      const itemWidth = Math.max(dayWidth, moodWidth) + 40
      if (x + itemWidth > width - 120) {
        x = left
        y += 120
      }
      if (y > 1110) break
      roundRect(ctx, x, y, itemWidth, 100, 24, toneColor[tone] ?? colors.pastels[3])
      ctx.fillStyle = colors.cardInk
      ctx.font = `600 26px ${font}`
      ctx.fillText(day, x + 20, y + 14)
      ctx.font = `700 34px ${font}`
      ctx.fillText(mood, x + 20, y + 50)
      x += itemWidth + 14
    }
  }

  ctx.fillStyle = colors.sub
  ctx.font = `600 28px ${font}`
  ctx.fillText(data.footer, left, height - 150)
}

/** 캔버스를 PNG로: 웹은 내려받기, 앱은 공유 창 */
export async function saveCanvas(canvas, fileName, { isNative, shareImage }) {
  if (isNative) {
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    await shareImage(fileName, base64)
    return
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
