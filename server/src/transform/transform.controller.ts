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

  @Post('step1')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async step1(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ code: number; msg: string; data: { step1Url: string; step1Key: string } }> {
    if (!file) {
      throw new BadRequestException('未收到文件，请用 field "file" 上传图片');
    }
    // 同时支持小程序 file.path 与 H5 file.buffer
    const buffer = file.buffer ?? (file.path ? await import('fs').then(fs => fs.promises.readFile(file.path)) : null);
    if (!buffer) {
      throw new BadRequestException('无法读取上传的文件内容');
    }
    const result = await this.transformService.step1(buffer, file.originalname || 'draft.png');
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }

  @Post('step2')
  @HttpCode(200)
  async step2(
    @Body() body: { imageUrl?: string },
  ): Promise<{ code: number; msg: string; data: { step2Url: string; step2Key: string } }> {
    const imageUrl = body?.imageUrl;
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new BadRequestException('imageUrl 不能为空');
    }
    const result = await this.transformService.step2(imageUrl);
    return {
      code: 200,
      msg: 'success',
      data: result,
    };
  }
}
