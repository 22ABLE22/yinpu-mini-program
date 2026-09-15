import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TransformController } from './transform.controller';
import { TransformService } from './transform.service';
import { StorageService } from './storage.service';
import { ColorProcessor } from './color.processor';
import { IMAGE_GENERATOR } from './image-generator';
import { ComfyUiGenerator } from './comfyui.generator';
import { MockImageGenerator } from './mock.generator';

/**
 * 印章转换模块
 * - /api/transform/step1：草稿图 → 干净印章图
 * - /api/transform/step2：印章图 → 宣纸钤印效果
 *
 * 生图实现由 IMAGE_GENERATOR 选择：
 * - IMAGE_GENERATOR=mock     → 透传输入图（调试链路）
 * - 默认 / comfy             → 本机 ComfyUI
 */
@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [TransformController],
  providers: [
    TransformService,
    StorageService,
    ColorProcessor,
    {
      provide: IMAGE_GENERATOR,
      useFactory: (storage: StorageService) => {
        const mode = (process.env.IMAGE_GENERATOR || 'comfy').toLowerCase();
        return mode === 'mock' ? new MockImageGenerator(storage) : new ComfyUiGenerator(storage);
      },
      inject: [StorageService],
    },
  ],
  exports: [StorageService],
})
export class TransformModule {}
