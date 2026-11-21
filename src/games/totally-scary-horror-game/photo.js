// Grabs a small JPEG "trading card" photo from a WebGL canvas. Must be
// called right after renderer.render() in the same frame (the drawing
// buffer isn't preserved between frames).
export function snapPhoto(canvas, w = 320, h = 200) {
  try {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    // center crop at the card's aspect ratio
    const srcAspect = canvas.width / canvas.height, dstAspect = w / h
    let sw = canvas.width, sh = canvas.height
    if (srcAspect > dstAspect) sw = sh * dstAspect; else sh = sw / dstAspect
    // zoom in a little toward the middle, where the monster sits
    sw *= 0.8; sh *= 0.8
    ctx.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2 - sh * 0.05, sw, sh, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.72)
  } catch {
    return null
  }
}
