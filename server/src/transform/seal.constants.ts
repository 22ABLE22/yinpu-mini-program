/** 印章类型与展示文案 */
export type SealType = 'baiwen' | 'zhuwen';

export type Stage = 'idle' | 'uploading' | 'sealing' | 'done' | 'error';

/** 朱砂印泥 / 宣纸色（与前端 app.css 品牌色一致） */
export const INK = {
  cinnabar: { r: 169, g: 50, b: 38 }, // #A93226
  paper: { r: 251, g: 247, b: 240 }, // #FBF7F0
} as const;
