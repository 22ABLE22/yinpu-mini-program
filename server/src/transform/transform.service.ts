import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import axios from 'axios';
import { StorageService } from './storage.service';

/**
 * 印章转换服务
 * 提供两步 AI 图生图：
 *  - step1：手写草稿 → 干净朱砂红印章
 *  - step2：印章图 → 宣纸钤印效果
 */
@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);
  private readonly client: ImageGenerationClient;

  constructor(private readonly storage: StorageService) {
    this.client = new ImageGenerationClient(new Config());
  }

  /**
   * 步骤 1：手写草稿 → 干净印章图
   * 核心约束：保留用户手画的结构（字形/布局/分割线），只做：
   *   - 黑色 → 朱砂红
   *   - 去除格子纸、米格、涂改痕迹
   *   - 背景纯白、笔画干净无杂色
   */
  async step1(draftBuffer: Buffer, originalName: string): Promise<{
    step1Url: string;
    step1Key: string;
  }> {
    this.logger.log(`step1: received draft buffer (${draftBuffer.length} bytes, name=${originalName})`);

    // 1) 上传草稿到对象存储，拿到可访问 URL（AI 图生图需要公网 URL）
    const { url: draftUrl } = await this.storage.uploadImage(draftBuffer, originalName);
    this.logger.log(`step1: draft uploaded, url=${draftUrl}`);

    // 2) 调 AI 图生图
    const prompt = [
      '把图中这张手写印章设计稿重新绘制为一个干净的中国传统印章。',
      '要求：',
      '1) 严格保留原稿的字形结构、笔画粗细、布局、方格分割与文字内容，不要修改或美化字形；',
      '2) 把所有原本为黑色的笔画和外框统一改成纯正的朱砂红色（cinnabar red），颜色饱满均匀；',
      '3) 彻底去除背景中的格子纸、米字格、辅助线、涂改痕迹、墨点、污渍；',
      '4) 背景必须是纯白色，文字笔画内部必须绝对干净，不能有任何灰色、黑色、深色斑点、阴影、墨渍；',
      '5) 印章边缘相对整齐，仅有极轻微的手工钤印感；',
      '6) 整体画面只有红色印章和白色背景两种颜色，不能有第三种杂色。',
    ].join(' ');

    this.logger.log(`step1: generating seal image from ${draftUrl}`);

    const response = await this.client.generate({
      prompt,
      image: draftUrl,
      size: '2K',
      watermark: false,
    });

    const helper = this.client.getResponseHelper(response);
    if (!helper.success || helper.imageUrls.length === 0) {
      throw new BadRequestException(`step1 生成失败：${helper.errorMessages.join('; ')}`);
    }

    // 3) 下载 AI 生成的图，重新上传到我们自己的存储（避免外部 URL 过期）
    const aiImageUrl = helper.imageUrls[0];
    const aiImageRes = await axios.get<ArrayBuffer>(aiImageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    const aiBuffer = Buffer.from(aiImageRes.data);
    const { key, url } = await this.storage.uploadImage(aiBuffer, 'step1_seal.png');

    this.logger.log(`step1: done, key=${key}`);

    return { step1Url: url, step1Key: key };
  }

  /**
   * 步骤 2：印章图 → 宣纸钤印效果
   * 输入：步骤 1 生成的印章图 URL
   * 输出：朱砂红印章 + 米白宣纸纹理的最终图
   */
  async step2(step1Url: string): Promise<{
    step2Url: string;
    step2Key: string;
  }> {
    const prompt = [
      '将图中这枚印章转换为传统中国宣纸钤印效果。',
      '核心要求：',
      '1) 背景替换为宣纸纹理质感，米白色宣纸底，可见淡淡纤维纹理；',
      '2) 印章红色调整为朱砂印泥色，颜色均匀饱满；',
      '3) 印章边缘相对整齐，仅有极轻微手工钤印感；',
      '4) 文字笔画区域保持纯白/纯米白底色，笔画轮廓清晰锐利，笔画内部绝对干净，不要有任何灰色、黑色、深色的斑点、污痕、脏点、墨渍或阴影；',
      '5) 整体画面干净，只有红色印章和米白宣纸两种颜色，不要有第三种杂色。',
      '6) 保留原印章的字形结构、布局、方格分割和文字内容，不要改变印章本身的设计。',
    ].join(' ');

    this.logger.log(`step2: generating rice paper effect from ${step1Url}`);

    const response = await this.client.generate({
      prompt,
      image: step1Url,
      size: '2K',
      watermark: false,
    });

    const helper = this.client.getResponseHelper(response);
    if (!helper.success || helper.imageUrls.length === 0) {
      throw new BadRequestException(`step2 生成失败：${helper.errorMessages.join('; ')}`);
    }

    const aiImageUrl = helper.imageUrls[0];
    const aiImageRes = await axios.get<ArrayBuffer>(aiImageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    const aiBuffer = Buffer.from(aiImageRes.data);
    const { key, url } = await this.storage.uploadImage(aiBuffer, 'step2_paper.png');

    this.logger.log(`step2: done, key=${key}`);

    return { step2Url: url, step2Key: key };
  }
}
