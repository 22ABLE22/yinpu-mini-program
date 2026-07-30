import { Injectable, Logger } from '@nestjs/common';
import { S3Storage } from 'coze-coding-dev-sdk';

/**
 * 对象存储服务：上传图片并返回签名 URL
 * 用于：把用户上传的草稿、AI 生成的中间图/最终图都保存到对象存储，
 *      然后生成可访问的 URL（供 AI 图生图使用 + 前端展示）。
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: S3Storage;

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }

  /**
   * 上传 buffer 到对象存储，返回签名 URL（有效期 1 天）
   */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    expireTime = 86400,
  ): Promise<{ key: string; url: string }> {
    const key = await this.storage.uploadFile({
      fileContent: buffer,
      fileName: filename,
      contentType,
    });
    const url = await this.storage.generatePresignedUrl({
      key,
      expireTime,
    });
    this.logger.log(`uploaded ${key} (${buffer.length} bytes)`);
    return { key, url };
  }

  /**
   * 从 Buffer 读出内容并按文件名/类型上传
   */
  async uploadImage(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const safeName = `yinpu/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return this.uploadBuffer(buffer, safeName, contentType);
  }
}
