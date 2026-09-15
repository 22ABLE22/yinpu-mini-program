import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import { ImageGenerateInput, ImageGenerateResult, ImageGenerator } from './image-generator';
import { StorageService } from './storage.service';

// form-data 是 CJS，ESM default 导入在 Nest/CommonJS 下会变成 undefined
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

/**
 * 本机 ComfyUI 图生图客户端。
 *
 * 环境变量：
 * - COMFYUI_BASE_URL，默认 http://127.0.0.1:8188
 * - COMFYUI_CHECKPOINT，默认 sd-v1-5-pruned.safetensors
 * - COMFYUI_WORKFLOW_PATH（可选）：自定义 workflow JSON
 *
 * 自定义 workflow 占位符：
 * - {{PROMPT}} / {{PROMPT_JSON}}  提示词（JSON 转义）
 * - {{IMAGE}}  已上传到 ComfyUI 的文件名
 * - {{DENOISE}} / {{WIDTH}} / {{HEIGHT}}
 */
@Injectable()
export class ComfyUiGenerator implements ImageGenerator {
  private readonly logger = new Logger(ComfyUiGenerator.name);
  private readonly baseUrl: string;

  constructor(private readonly storage: StorageService) {
    this.baseUrl = (process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188').replace(
      /\/$/,
      '',
    );
  }

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const imageName = await this.uploadInputToComfy(input.imageUrl);
    const workflow = await this.buildWorkflow(input, imageName);
    const promptId = await this.queuePrompt(workflow);
    this.logger.log(`ComfyUI queued prompt_id=${promptId} image=${imageName}`);

    // 8G 显存 + 首次加载模型可能超过 4 分钟，给到 10 分钟
    const timeoutMs = parseInt(process.env.COMFYUI_TIMEOUT_MS || '600000', 10);
    const outputs = await this.waitHistory(promptId, timeoutMs);
    if (outputs.length === 0) {
      throw new ServiceUnavailableException('ComfyUI 未返回图片输出');
    }

    const buffer = await this.downloadOutput(outputs[0]);
    const { url } = await this.storage.uploadImage(buffer, 'comfyui_out.png');
    this.logger.log(`ComfyUI result saved: ${url}`);
    return { url, rawFilename: outputs[0].filename };
  }

  /** 把输入图 URL 下载后，再上传到 ComfyUI，返回它内部的 image 文件名 */
  private async uploadInputToComfy(imageUrl: string): Promise<string> {
    const downloaded = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    const buf = Buffer.from(downloaded.data);
    const ext = imageUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'png';
    const filename = `yinpu_in_${Date.now()}.${/^(png|jpe?g|webp|bmp)$/.test(ext) ? ext : 'png'}`;

    const form = new FormData();
    form.append('image', buf, { filename, contentType: 'image/png' });
    form.append('overwrite', 'true');

    try {
      const res = await axios.post(`${this.baseUrl}/upload/image`, form, {
        headers: form.getHeaders(),
        timeout: 60_000,
      });
      const name = res.data?.name || filename;
      this.logger.log(`uploaded input to ComfyUI as ${name}`);
      return name as string;
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED') {
        throw new ServiceUnavailableException(
          `无法连接 ComfyUI（${this.baseUrl}）。请先启动 ComfyUI。`,
        );
      }
      throw new ServiceUnavailableException(`上传输入图到 ComfyUI 失败: ${err?.message || err}`);
    }
  }

  private async buildWorkflow(
    input: ImageGenerateInput,
    comfyImageName: string,
  ): Promise<Record<string, unknown>> {
    const customPath = process.env.COMFYUI_WORKFLOW_PATH;
    if (customPath) {
      const raw = await fs.readFile(customPath, 'utf-8');
      const replaced = raw
        .replace(/\{\{PROMPT_JSON\}\}/g, this.escapeForJsonString(input.prompt))
        .replace(/\{\{PROMPT\}\}/g, this.escapeForJsonString(input.prompt))
        .replace(/\{\{IMAGE\}\}/g, this.escapeForJsonString(comfyImageName))
        .replace(/\{\{DENOISE\}\}/g, String(input.denoise ?? 0.55))
        .replace(/\{\{WIDTH\}\}/g, String(input.width ?? 512))
        .replace(/\{\{HEIGHT\}\}/g, String(input.height ?? 512));
      return JSON.parse(replaced);
    }

    const controlNet = process.env.COMFYUI_CONTROLNET || '';
    if (controlNet) {
      this.logger.log(`using ControlNet: ${controlNet}`);
      return this.controlNetImg2ImgWorkflow(input, comfyImageName, controlNet);
    }
    this.logger.warn(
      'COMFYUI_CONTROLNET 未设置，回退为纯 img2img（字形保真较差）。建议下载 control_v11p_sd15_canny.pth',
    );
    return this.defaultImg2ImgWorkflow(input, comfyImageName);
  }

  /**
   * SD1.5 + ControlNet(Canny) img2img：
   * 线稿锁字形结构，再上色为印章。
   */
  private controlNetImg2ImgWorkflow(
    input: ImageGenerateInput,
    comfyImageName: string,
    controlNetName: string,
  ): Record<string, unknown> {
    // 有 ControlNet 时 denoise 可稍高一点换风格，结构由 Canny 锁住
    const denoise = input.denoise ?? 0.55;
    const checkpoint = process.env.COMFYUI_CHECKPOINT || 'v1-5-pruned-emaonly.safetensors';
    const strength = input.cnStrength ?? parseFloat(process.env.COMFYUI_CN_STRENGTH || '0.85');
    const steps = parseInt(process.env.COMFYUI_STEPS || '16', 10);

    return {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 1_000_000_000),
          steps,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise,
          model: ['4', 0],
          positive: ['18', 0],
          negative: ['18', 1],
          latent_image: ['12', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: checkpoint },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: input.prompt, clip: ['4', 1] },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text:
            'photo, blurry, low quality, watermark, 3d render, gradient, shadow, noise, messy background, deformed characters, extra strokes, english letters, numbers',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['4', 2] },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'yinpu_cn', images: ['8', 0] },
      },
      '10': {
        class_type: 'LoadImage',
        inputs: { image: comfyImageName },
      },
      '12': {
        class_type: 'VAEEncode',
        inputs: { pixels: ['10', 0], vae: ['4', 2] },
      },
      // 内置 Canny 提线稿
      '16': {
        class_type: 'Canny',
        inputs: {
          image: ['10', 0],
          low_threshold: parseFloat(process.env.COMFYUI_CANNY_LOW || '0.3'),
          high_threshold: parseFloat(process.env.COMFYUI_CANNY_HIGH || '0.7'),
        },
      },
      '17': {
        class_type: 'ControlNetLoader',
        inputs: { control_net_name: controlNetName },
      },
      '18': {
        class_type: 'ControlNetApplyAdvanced',
        inputs: {
          positive: ['6', 0],
          negative: ['7', 0],
          control_net: ['17', 0],
          image: ['16', 0],
          strength,
          start_percent: 0,
          end_percent: 1,
        },
      },
    };
  }

  /**
   * 内置 SD1.5 img2img：
   * LoadImage → VAEEncode → KSampler(Checkpoint) → VAEDecode → SaveImage
   */
  private defaultImg2ImgWorkflow(
    input: ImageGenerateInput,
    comfyImageName: string,
  ): Record<string, unknown> {
    const denoise = input.denoise ?? 0.55;
    const checkpoint = process.env.COMFYUI_CHECKPOINT || 'sd-v1-5-pruned.safetensors';

    return {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 1_000_000_000),
          // 8G 显存：16 步足够出图，且比 22 步快不少
          steps: parseInt(process.env.COMFYUI_STEPS || '16', 10),
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['12', 0],
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: checkpoint },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: input.prompt, clip: ['4', 1] },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'blurry, low quality, watermark, text logo, deformed characters, messy strokes',
          clip: ['4', 1],
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['4', 2] },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: { filename_prefix: 'yinpu', images: ['8', 0] },
      },
      '10': {
        class_type: 'LoadImage',
        inputs: { image: comfyImageName },
      },
      '12': {
        class_type: 'VAEEncode',
        inputs: { pixels: ['10', 0], vae: ['4', 2] },
      },
    };
  }

  private escapeForJsonString(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  private async queuePrompt(workflow: Record<string, unknown>): Promise<string> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/prompt`,
        { prompt: workflow, client_id: 'yinpu-nest' },
        { timeout: 30_000 },
      );
      const id = res.data?.prompt_id;
      if (!id) {
        throw new Error(`ComfyUI /prompt 响应异常: ${JSON.stringify(res.data).slice(0, 240)}`);
      }
      return id as string;
    } catch (err: any) {
      if (err?.response?.data) {
        const detail = JSON.stringify(err.response.data).slice(0, 300);
        throw new ServiceUnavailableException(`ComfyUI 拒绝任务: ${detail}`);
      }
      if (err?.code === 'ECONNREFUSED') {
        throw new ServiceUnavailableException(
          `无法连接 ComfyUI（${this.baseUrl}）。请先启动 ComfyUI，或设置 COMFYUI_BASE_URL。`,
        );
      }
      throw new ServiceUnavailableException(`ComfyUI 提交任务失败: ${err?.message || err}`);
    }
  }

  private async waitHistory(
    promptId: string,
    timeoutMs: number,
  ): Promise<Array<{ filename: string; subfolder: string; type: string }>> {
    const deadline = Date.now() + timeoutMs;
    let waited = 0;
    while (Date.now() < deadline) {
      const hist = await axios.get(`${this.baseUrl}/history/${promptId}`, { timeout: 15_000 });
      const entry = hist.data?.[promptId];
      if (entry) {
        if (entry.status?.status_str === 'error') {
          throw new ServiceUnavailableException('ComfyUI 执行失败，请查看 ComfyUI 控制台日志');
        }
        const outputs = entry.outputs || {};
        const images: Array<{ filename: string; subfolder: string; type: string }> = [];
        for (const nodeOutput of Object.values(outputs) as any[]) {
          if (Array.isArray(nodeOutput?.images)) {
            images.push(...nodeOutput.images);
          }
        }
        if (images.length > 0) return images;
      }
      waited += 800;
      if (waited % 8000 === 0) {
        this.logger.log(`waiting ComfyUI ${promptId}... ${Math.round(waited / 1000)}s`);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    throw new ServiceUnavailableException(
      `ComfyUI 生成超时（已等待 ${Math.round(timeoutMs / 1000)}s）。任务可能仍在 ComfyUI 中执行，完成后可在输出目录查看。`,
    );
  }

  private async downloadOutput(file: {
    filename: string;
    subfolder?: string;
    type?: string;
  }): Promise<Buffer> {
    const qs = new URLSearchParams({
      filename: file.filename,
      subfolder: file.subfolder || '',
      type: file.type || 'output',
    });
    const res = await axios.get<ArrayBuffer>(`${this.baseUrl}/view?${qs.toString()}`, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    return Buffer.from(res.data);
  }
}
