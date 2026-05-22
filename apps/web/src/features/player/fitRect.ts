export type FitRectInput = {
  containerW: number
  containerH: number
  frameW: number
  frameH: number
}

export type FitRectResult = {
  width: number
  height: number
  scale: number
}

export const calcFitRect = ({
  containerW,
  containerH,
  frameW,
  frameH,
}: FitRectInput): FitRectResult => {
  if (containerW <= 0 || containerH <= 0 || frameW <= 0 || frameH <= 0) {
    return { width: 0, height: 0, scale: 0 }
  }

  const scale = Math.min(containerW / frameW, containerH / frameH)
  return {
    width: Math.round(frameW * scale),
    height: Math.round(frameH * scale),
    scale,
  }
}
