export interface ImageGenerateInput {
  prompt: string;
  /** 公网或本机可访问的输入图 URL（ComfyUI 需能 fetch） */
  imageUrl: string;
  width?: number;
  height?: number;
  /** 0~1，img2img 重绘幅度 */
  denoise?: number;
  /** 覆盖 ControlNet 强度；step2 可调低以便去掉外圈 */
  cnStrength?: number;
}

export interface ImageGenerateResult {
  /** 生成结果的可访问 URL（已由存储层落盘） */
  url: string;
  /** 可选，ComfyUI 本地文件名，便于调试 */
  rawFilename?: string;
}

export interface ImageGenerator {
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>;
}

export const IMAGE_GENERATOR = Symbol('IMAGE_GENERATOR');
