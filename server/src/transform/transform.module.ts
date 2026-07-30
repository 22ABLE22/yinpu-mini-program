import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TransformController } from './transform.controller';
import { TransformService } from './transform.service';
import { StorageService } from './storage.service';

/**
 * 印章转换模块
 * - /api/transform/step1：草稿图 → 干净印章图
 * - /api/transform/step2：印章图 → 宣纸钤印效果
 */
@Module({
  imports: [
    // 内存存储：上传后直接拿到 buffer，传入对象存储
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [TransformController],
  providers: [TransformService, StorageService],
  exports: [StorageService],
})
export class TransformModule {}
