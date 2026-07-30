import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { TransformModule } from '@/transform/transform.module';

@Module({
  imports: [TransformModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
