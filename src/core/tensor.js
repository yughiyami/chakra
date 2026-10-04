// Preprocess parity with training: RGB, CHW, float32 in [0, 1], alpha dropped.
// Normalization (ImageNet mean/std) lives INSIDE the ONNX graph — never here.
export function rgbaToCHW(rgba, width, height) {
  const plane = width * height
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const j = i * 4
    out[i] = rgba[j] / 255
    out[plane + i] = rgba[j + 1] / 255
    out[2 * plane + i] = rgba[j + 2] / 255
  }
  return out
}
