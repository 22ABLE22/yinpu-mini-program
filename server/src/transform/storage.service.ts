import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * 本地磁盘存储（脱离扣子 S3）。
 * - 文件写到 UPLOAD_DIR（默认 server/uploads）
 * - 返回 PUBLIC_BASE_URL + /uploads/xxx
 * - main.ts 会把 /uploads 静态映射到该目录
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly publicBase: string;

  constructor() {
    this.uploadDir = path.resolve(
      process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    );
    fs.mkdirSync(this.uploadDir, { recursive: true });

    const port = process.env.PORT || '3000';
    this.publicBase = (
      process.env.PUBLIC_BASE_URL || `http://localhost:${port}`
    ).replace(/\/$/, '');
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  /** 写入 buffer，返回 { key, url } */
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<{ key: string; url: string }> {
    const safeName = this.sanitizeName(filename);
    const abs = path.join(this.uploadDir, safeName);
    await fsp.writeFile(abs, buffer);
    this.logger.log(`saved ${safeName} (${buffer.length} bytes) → ${abs}`);
    return {
      key: safeName,
      url: `${this.publicBase}/uploads/${safeName}`,
    };
  }

  /** 按扩展名推断 content-type 后上传图片 */
  async uploadImage(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ key: string; url: string }> {
    const ext = (originalName.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const name = `${Date.now()}_${randomBytes(3).toString('hex')}.${ext === 'jpg' ? 'jpg' : ext === 'jpeg' ? 'jpeg' : 'png'}`;
    return this.uploadBuffer(buffer, name, contentType);
  }

  private sanitizeName(name: string): string {
    return name.replace(/[\\/:\*\?"<>\|]/g, '_').slice(-80);
  }
}
