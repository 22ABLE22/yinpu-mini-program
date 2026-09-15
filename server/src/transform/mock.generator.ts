import { Injectable } from '@nestjs/common';
import { ImageGenerateInput, ImageGenerateResult, ImageGenerator } from './image-generator';
import { StorageService } from './storage.service';

/**
 * 调试用：不调真实模型，直接把输入图原样当作结果返回。
 * 设置 IMAGE_GENERATOR=mock 时启用，方便先跑通上传/展示/保存链路。
 */
@Injectable()
export class MockImageGenerator implements ImageGenerator {
  constructor(private readonly storage: StorageService) {}

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const axios = (await import('axios')).default;
    const res = await axios.get<ArrayBuffer>(input.imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    const buffer = Buffer.from(res.data);
    const { url } = await this.storage.uploadImage(buffer, 'mock_passthrough.png');
    return { url };
  }
}
