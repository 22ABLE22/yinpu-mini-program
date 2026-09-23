/** 确定性纸张颗粒：同坐标同噪声，便于复现 */
export function paperNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const frac = n - Math.floor(n);
  const n2 = Math.sin(x * 3.1 + y * 7.7) * 12345.678;
  const frac2 = n2 - Math.floor(n2);
  return (frac - 0.5) * 7 + (frac2 - 0.5) * 4;
}

export function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function lumaOf(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isReddish(r: number, g: number, b: number): boolean {
  return r > g + 30 && r > b + 30 && r > 70;
}
