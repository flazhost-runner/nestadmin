import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global storage module — exposes StorageService everywhere (view-locals
 * middleware, media, profile/setting/user uploads) without per-module imports.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
