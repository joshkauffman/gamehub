// WebGL canvases normally clear their picture right after it's shown, so
// copying one later (for the 📸 photo button) gives a blank image. Asking
// every WebGL context to keep its last frame fixes that for all the 3D games
// at once. Must run before any game creates a canvas, so main.jsx imports
// this first.
const original = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function getContext(type, attrs) {
  if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') attrs = { ...attrs, preserveDrawingBuffer: true }
  return original.call(this, type, attrs)
}
