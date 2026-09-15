import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { StorageService } from '@/transform/storage.service';

// 优先读 server/.env.local，再读仓库根 .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return parseInt(process.env.PORT || '3000', 10) || 3000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 开发期放宽 CORS；上线请改成具体域名列表
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 本地上传目录静态托管（StorageService 写入处）
  const storage = app.get(StorageService);
  const uploadDir = storage.getUploadDir();
  app.use(
    '/uploads',
    express.static(uploadDir, {
      maxAge: '1d',
      fallthrough: true,
    }),
  );

  app.useGlobalInterceptors(new HttpStatusInterceptor());
  app.enableShutdownHooks();

  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Static uploads: http://localhost:${port}/uploads/ → ${uploadDir}`);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      console.error(`端口 ${port} 被占用! 请关闭占用进程或设置 PORT。`);
      process.exit(1);
    }
    throw err;
  }
}
bootstrap();
