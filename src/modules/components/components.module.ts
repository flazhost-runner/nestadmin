import { Module } from '@nestjs/common';
import { ComponentsWebController } from './controllers/web/v1/ComponentsWebController';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ComponentsWebController],
})
export class ComponentsModule {}
