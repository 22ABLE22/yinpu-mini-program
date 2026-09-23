/**
 * 印章图生图提示词（SD1.5，英文更稳）。
 * step1：草稿 → 白文/朱文印面；step2：白文钤印宣纸底。
 */
export function buildStep1Prompt(type: 'baiwen' | 'zhuwen'): string {
  const base = [
    'flat vector style traditional Chinese carved seal',
    'ONLY two colors: dark cinnabar red and off-white',
    'square seal with thick border',
    'seal script (zhuan shu) character strokes',
    'solid color fill, no gradient, no paper texture, no grid lines',
    'no shadow, no 3d, no photo, no watermark, no English text',
    'centered composition, high contrast',
  ];
  if (type === 'zhuwen') {
    base.push('yang carving zhuwen intaglio: white background, red characters and red border');
  } else {
    base.push('yin carving baiwen relief: solid red background, white character strokes carved out');
  }
  return base.join(', ');
}

/** 白文 step2：保持红底白字，换宣纸，去掉外层细红圈 */
export function buildStep2BaiwenPrompt(): string {
  return [
    'Keep this exact Chinese baiwen seal: solid dark cinnabar red background, white carved character strokes, white seal border.',
    'Do NOT invert colors. Do NOT make white background with red characters.',
    'Replace the surrounding area with traditional Chinese xuan rice paper: off-white handmade paper, subtle fiber grain.',
    'Keep only ONE square seal border that tightly wraps the characters.',
    'Remove any extra outer thin red ring, second outline, or decorative red frame outside the main seal.',
    'Outside the seal square: only clean rice paper, no red ink, no second border, no shadow, no grid.',
    'Flat illustration, centered seal, high quality.',
  ].join(' ');
}

/** 通用宣纸提示（预留） */
export function buildStep2Prompt(): string {
  return [
    'traditional Chinese xuan rice paper, off-white handmade paper with subtle fiber',
    'place this square seal stamp on the paper',
    'keep seal colors: dark cinnabar red and white strokes',
    'flat illustration, no grid lines, no photo, no extra objects',
    'soft even lighting, clean background',
  ].join(', ');
}

/** 通用宣纸提示（兼容旧调用） */
export function buildStep2Prompt(): string {
  return [
    'traditional Chinese xuan rice paper, off-white handmade paper with subtle fiber',
    'place this square seal stamp on the paper',
    'keep seal colors: dark cinnabar red and white strokes',
    'flat illustration, no grid lines, no photo, no extra objects',
    'soft even lighting, clean background',
  ].join(', ');
}
