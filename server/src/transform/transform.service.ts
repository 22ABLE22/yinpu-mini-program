import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { StorageService } from './storage.service';
import { ColorProcessor } from './color.processor';
import { IMAGE_GENERATOR, ImageGenerator } from './image-generator';
import { buildStep1Prompt, buildStep2BaiwenPrompt } from './seal-prompts';

/**
 * 印章转换服务
 *  - step1：手写草稿 → 干净朱砂红印章
 *  - step2：印章图 → 宣纸钤印效果
 *
 * 生图通过注入的 ImageGenerator（ComfyUI / Mock），颜色后处理仍在本服务用 sharp 完成。
 */
@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly colorProcessor: ColorProcessor,
    @Inject(IMAGE_GENERATOR) private readonly generator: ImageGenerator,
  ) {}

  async step1(
    draftBuffer: Buffer,
    originalName: string,
    type: 'baiwen' | 'zhuwen' = 'baiwen',
  ): Promise<{ step1Url: string; step1Key: string }> {
    this.logger.log(
      `step1[${type}]: received draft buffer (${draftBuffer.length} bytes, name=${originalName})`,
    );

    // 预处理：去掉红色格子线，只留墨迹线稿，避免 ControlNet 锁死格子纸
    const lineArt = await this.colorProcessor.toControlNetLineArt(draftBuffer);
    const { url: draftUrl } = await this.storage.uploadImage(lineArt, 'draft_lineart.png');
    this.logger.log(`step1[${type}]: lineart uploaded, url=${draftUrl}`);

    const prompt = buildStep1Prompt(type);
    // 风格转换要够强：denoise 偏高，结构交给 ControlNet
    const generated = await this.generator.generate({
      prompt,
      imageUrl: draftUrl,
      width: 512,
      height: 512,
      denoise: type === 'zhuwen' ? 0.68 : 0.72,
    });

    const aiBuffer = await this.fetchBuffer(generated.url);
    const useMock = (process.env.IMAGE_GENERATOR || '').toLowerCase() === 'mock';
    let processedBuffer: Buffer;
    if (useMock) {
      processedBuffer = await this.colorProcessor.adjustRedToDarkCinnabar(aiBuffer);
    } else if (type === 'zhuwen') {
      processedBuffer = await this.colorProcessor.adjustToZhuwenSeal(aiBuffer);
    } else {
      processedBuffer = await this.colorProcessor.adjustToBaiwenSeal(aiBuffer);
    }

    const { key, url } = await this.storage.uploadImage(processedBuffer, 'step1_seal.png');
    this.logger.log(`step1: done, key=${key}`);
    return { step1Url: url, step1Key: key };
  }

  async step2(
    step1Url: string,
    type: 'baiwen' | 'zhuwen' = 'baiwen',
  ): Promise<{ step2Url: string; step2Key: string }> {
    // 朱文：不走 AI，只把白底调成米白宣纸色
    if (type === 'zhuwen') {
      this.logger.log(`step2[zhuwen]: reuse step1 image, shift white to rice paper`);
      const originalBuffer = await this.fetchBuffer(step1Url);
      const processedBuffer = await this.colorProcessor.shiftWhiteToRicePaper(originalBuffer);
      const { key, url } = await this.storage.uploadImage(processedBuffer, 'step2_paper.png');
      return { step2Url: url, step2Key: key };
    }

    // 白文 step2：
    // step1 已是「红底白字」成品，这里只负责「放到宣纸上 + 去掉外层多余细红圈」，
    // 绝不能再跑 adjustToBaiwenSeal（会把红/白反相）。
    const prompt = buildStep2BaiwenPrompt();
    const generated = await this.generator.generate({
      prompt,
      imageUrl: step1Url,
      width: 512,
      height: 512,
      // 结构优先，只让模型改纸面/外圈，避免把印文改花
      denoise: 0.48,
      cnStrength: 0.55,
    });

    const aiBuffer = await this.fetchBuffer(generated.url);
    // 仅把红色收成暗朱砂，不改变红/白关系，不做反相
    const processedBuffer = await this.colorProcessor.adjustRedToDarkCinnabar(aiBuffer);
    const { key, url } = await this.storage.uploadImage(processedBuffer, 'step2_paper.png');
    this.logger.log(`step2[baiwen]: paper+cleanup done, key=${key}`);
    return { step2Url: url, step2Key: key };
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    try {
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 60_000,
      });
      return Buffer.from(res.data);
    } catch (err: any) {
      throw new BadRequestException(`下载图片失败: ${err?.message || err}`);
    }
  }
}
