import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import axios from 'axios';
import { StorageService } from './storage.service';
import { ColorProcessor } from './color.processor';

/**
 * 印章转换服务
 * 提供两步 AI 图生图：
 *  - step1：手写草稿 → 干净朱砂红印章
 *  - step2：印章图 → 宣纸钤印效果
 *
 * 两步完成后都做一次颜色后处理，把 AI 倾向的"鲜红"统一调成"西泠印社朱标印泥"的暗朱红。
 */
@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);
  private readonly client: ImageGenerationClient;

  constructor(
    private readonly storage: StorageService,
    private readonly colorProcessor: ColorProcessor,
  ) {
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
    // 关键：传统阳刻印章 = 红底白字（字是阳文保留的留白，红是被刻掉区域填充的印泥）
    //     原稿黑色笔画 → 印章的"白字留白"；原稿白色底 → 印章的"朱砂红底"
    // 颜色：用西泠印社"朱标"印泥的暗朱红色（深沉、饱和、偏暗红），不要用大红色
    const prompt = [
      '把图中这张手写印章设计稿重新绘制为一个干净的中国传统阳刻印章效果图。',
      '【颜色逻辑 - 最重要】采用【红底白字】结构：',
      '  - 原稿中黑色笔画对应的区域 = 印章的【白字留白】（阳刻保留的字形，呈现白色/米白色）；',
      '  - 原稿中白色背景对应的区域 = 印章的【朱砂红印泥底】；',
      '  - 字是白色，背景是红色，与原稿颜色正好相反（原稿黑字 → 白字；原稿白底 → 红底）。',
      '【印章外框】整体加上一个印章的方形外框（红色描边），框线粗细均匀。',
      '【朱砂红色号 - 关键】必须使用【西泠印社"朱标"印泥】的色调，这是中国传统老印泥的【暗朱砂红 / 枣红 / 酒红】，是经年使用后自然氧化沉淀的深沉红，【绝对不能使用大红色或鲜红色】。',
      '  - 这种红色的视觉感受：像陈年朱砂印泥、像老印章盖在宣纸上的红、像暗红/枣红/酒红，【不刺眼、不鲜亮、不饱和过度】；',
      '  - 参考色值（按优先级）：hex #A93226 / #922B21 / #8B2A1F / #B83A2A / #C0392B / #993322 / #8B1A1A；',
      '  - RGB 范围：R 在 130-180 之间，G 在 25-60 之间，B 在 25-55 之间，R 与 G/B 差值 80-150（差值越大越暗沉）；',
      '  - 【绝对禁止使用】：鲜红 #E2211A / #FF0000 / #DC143C / #FF4444 / #FF3030 / #E60000 这一类；',
      '  - 【绝对禁止使用】：大红色 #FF0000 / #FF1A1A / 任何 R>200 且 G<20 的红色；',
      '  - 【绝对禁止使用】：粉红/橙红/橘红/玫红/正红；',
      '  - 关键判断：你的 R 值不能超过 200，理想范围 130-180。G 和 B 都必须在 20-60 之间。',
      '【结构保真】严格保留原稿的字形结构、笔画粗细、布局、方格分割与文字内容，不要修改或美化字形。',
      '【清理】彻底去除原稿中的格子纸、米字格、辅助线、涂改痕迹、墨点、污渍。',
      '【笔画内部】白字（留白）内部必须绝对干净，不能有任何红/灰/黑色斑点、阴影、墨渍。',
      '【整体】整个画面只有【朱砂红（印泥色）+ 白色（字形留白）】两种颜色，不能有第三种杂色。',
      '【边缘】印章边缘相对整齐，仅有极轻微的手工钤印感。',
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

    // 4) 颜色后处理：把 AI 倾向的"鲜红"统一调成"西泠印社朱标印泥"的暗朱红
    const processedBuffer = await this.colorProcessor.adjustRedToDarkCinnabar(aiBuffer);

    const { key, url } = await this.storage.uploadImage(processedBuffer, 'step1_seal.png');

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
    // 关键：保持印章本体的【红底白字】结构，只换背景
    // 颜色：用西泠印社"朱标"印泥的暗朱红色（深沉、饱和、偏暗红），不要用大红色
    const prompt = [
      '将图中这枚印章转换为传统中国宣纸钤印效果。',
      '【印章本体保持】印章的【红底白字】结构、字形、布局、方格分割、白色字形留白必须完全保持原样，绝不能把红白关系反转，也不能改字。',
      '【背景替换】把印章周围的大面积背景替换为传统中国米白色宣纸的质感：',
      '  - 颜色：米白色（off-white），类似 hex #FBF7F0 / #F5EFE0；',
      '  - 可见淡淡的手工宣纸纤维纹理、纸张颗粒感；',
      '  - 背景中可以保留非常浅淡的宣纸暗影、轻微的纸张不均匀感，模拟真实宣纸。',
      '【朱砂红色号 - 关键】印章的红色必须是【西泠印社"朱标"印泥】的【暗朱砂红 / 枣红 / 酒红】，是经年使用后自然氧化沉淀的深沉红，【绝对不能使用大红色或鲜红色】。',
      '  - 这种红色的视觉感受：像陈年朱砂印泥、像老印章盖在宣纸上的红、像暗红/枣红/酒红，【不刺眼、不鲜亮、不饱和过度】；',
      '  - 参考色值（按优先级）：hex #A93226 / #922B21 / #8B2A1F / #B83A2A / #C0392B / #993322 / #8B1A1A；',
      '  - RGB 范围：R 在 130-180 之间，G 在 25-60 之间，B 在 25-55 之间，R 与 G/B 差值 80-150（差值越大越暗沉）；',
      '  - 【绝对禁止使用】：鲜红 #E2211A / #FF0000 / #DC143C / #FF4444 / #FF3030 / #E60000 这一类；',
      '  - 【绝对禁止使用】：大红色 #FF0000 / #FF1A1A / 任何 R>200 且 G<20 的红色；',
      '  - 【绝对禁止使用】：粉红/橙红/橘红/玫红/正红；',
      '  - 关键判断：你的 R 值不能超过 200，理想范围 130-180。G 和 B 都必须在 20-60 之间。',
      '【边缘】印章边缘相对整齐，仅有极轻微的手工钤印感。',
      '【字形内部】白字（留白）内部必须保持纯白/纯米白底色，绝对干净，不能有任何红色斑点、灰色、黑色、深色的斑点、污痕、脏点、墨渍或阴影。',
      '【整体】整个画面只有【朱砂红（印泥色）+ 米白宣纸】两种颜色，不能出现第三种杂色。',
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

    // 颜色后处理：再次确认整图（包括 AI 引入的红色杂点）都调成暗朱红
    const processedBuffer = await this.colorProcessor.adjustRedToDarkCinnabar(aiBuffer);

    const { key, url } = await this.storage.uploadImage(processedBuffer, 'step2_paper.png');

    this.logger.log(`step2: done, key=${key}`);

    return { step2Url: url, step2Key: key };
  }
}
