import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './models/setting.entity';
import { SettingService } from './services/v1/SettingService';
import { SettingWebController } from './controllers/web/v1/SettingWebController';
import { SettingApiController } from './controllers/api/v1/SettingApiController';
import { SettingCacheService } from '../../services/setting-cache.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting]), AuthModule],
  controllers: [SettingWebController, SettingApiController],
  providers: [SettingService, SettingCacheService],
  exports: [SettingService, SettingCacheService],
})
export class SettingModule {}
