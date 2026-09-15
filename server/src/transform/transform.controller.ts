import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransformService } from './transform.service';

/**
 * 印章转换 Controller
 * - POST /api/transform/step1  草稿图(multipart) → 朱砂红印章图URL
 * - POST /api/transform/step2  印章图URL(json) → 宣纸钤印图URL
 */
@Controller('transform')
export class TransformController {
  constructor(private readonly transformService: TransformService) {}

  /**
   * step2 会服务端拉取 imageUrl，仅允许本机/项目存储域名，避免 SSRF。
   * 白名单：localhost、127.0.0.1，以及 PUBLIC_BASE_URL / COZE_BUCKET_ENDPOINT_URL 的主机名。
   */
  private isAllowedImageUrl(imageUrl: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const allowHosts = new Set<string>(['localhost', '127.0.0.1']);

    const endpoints = [
      process.env.PUBLIC_BASE_URL,
      process.env.COZE_BUCKET_ENDPOINT_URL,
    ].filter(Boolean) as string[];

    for (const ep of endpoints) {
      try {
        allowHosts.add(new URL(ep).hostname.toLowerCase());
      } catch {
        // 忽略非法 endpoint
      }
    }

    return allowHosts.has(host);
  }

  @Post('step1')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async step1(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { type?: string } = {},
  ): Promise<{ code: number; msg: string; data: { step1Url: string; step1Key: string } }> {
    if (!file) {
      throw new BadRequestException('未收到文件，请用 field "file" 上传图片');
    }
    // 同时支持小程序 file.path 与 H5 file.buffer
    const buffer = file.buffer ?? (file.path ? await import('fs').then(fs => fs.promises.readFile(file.path)) : null);
    if (!buffer) {
      throw new BadRequestException('无法读取上传的文件内容');
    }
    // 印章类型：baiwen 白文（阴文·红底白字·反色）| zhuwen 朱文（阳文·白底红字·不反色）
    const rawType = (body?.type || 'baiwen').toLowerCase();
    const type: 'baiwen' | 'zhuwen' = rawType === 'zhuwen' ? 'zhuwen' : 'baiwen';
    const result = await this.transformService.step1(buffer, file.originalname || 'draft.png', type);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  @Post('step2')
  @HttpCode(200)
  async step2(
    @Body() body: { imageUrl?: string; type?: string },
  ): Promise<{ code: number; msg: string; data: { step2Url: string; step2Key: string } }> {
    const imageUrl = body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new BadRequestException('imageUrl 不能为空');
    }
    if (!this.isAllowedImageUrl(imageUrl)) {
      throw new BadRequestException('imageUrl 域名不合法');
    }
    const rawType = (body?.type || 'baiwen').toLowerCase();
    const type: 'baiwen' | 'zhuwen' = rawType === 'zhuwen' ? 'zhuwen' : 'baiwen';
    const result = await this.transformService.step2(imageUrl, type);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }
}
