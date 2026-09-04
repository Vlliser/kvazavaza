// Скрипт для генерации placeholder PNG-иконок через Canvas API
// Запускается один раз в браузере для создания icon-192.png и icon-512.png
// Потом заменишь их на настоящие арт-иконки

const sizes = [192, 512]

sizes.forEach(size => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const scale = size / 192

  // Фон — тёмный фиолетовый
  ctx.fillStyle = '#2C1654'
  ctx.fillRect(0, 0, size, size)

  // Пиксели (закруглённый квадрат вместо круга для pixel-art стиля)
  ctx.fillStyle = '#4A0E8F'
  ctx.fillRect(size * 0.05, size * 0.05, size * 0.9, size * 0.9)

  ctx.fillStyle = '#2C1654'
  ctx.fillRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84)

  // Сердце из прямоугольников (pixel-art)
  ctx.fillStyle = '#E040FB'
  const px = Math.floor(12 * scale)
  const hx = Math.floor(size / 2)
  const hy = Math.floor(size / 2)

  // Пиксели сердца
  const heart = [
    [0,-2],[1,-2],[3,-2],[4,-2],
    [-1,-1],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],
    [-1,0],[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],
    [0,1],[1,1],[2,1],[3,1],[4,1],
    [1,2],[2,2],[3,2],
    [2,3],
  ]

  heart.forEach(([dx, dy]) => {
    ctx.fillRect(hx + dx * px - px * 2, hy + dy * px - px, px - 1, px - 1)
  })

  // Надпись "KV" снизу
  ctx.fillStyle = '#CE93D8'
  ctx.font = `bold ${Math.floor(20 * scale)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText('KV', size / 2, size * 0.88)

  // Скачиваем
  const a = document.createElement('a')
  a.download = `icon-${size}.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
})
