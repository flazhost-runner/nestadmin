import { Module } from '@nestjs/common';
import { HomeController } from './controllers/home.controller';
import { FeTemplateService } from './services/fe-template.service';
import { FeCatalogService } from './services/fe-catalog.service';

@Module({
  controllers: [HomeController],
  providers: [FeTemplateService, FeCatalogService],
  exports: [FeTemplateService, FeCatalogService],
})
export class HomeModule {}
