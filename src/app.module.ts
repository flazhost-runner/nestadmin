import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { envValidationSchema } from './config/env';
import { AuthModule } from './modules/auth/auth.module';
import { AccessModule } from './modules/access/access.module';
import { SettingModule } from './modules/setting/setting.module';
import { ProfileModule } from './modules/profile/profile.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ComponentsModule } from './modules/components/components.module';
import { HomeModule } from './modules/home/home.module';
import { MediaModule } from './modules/media/media.module';
import { StorageModule } from './services/storage.module';
import { ViewLocalsMiddleware } from './middleware/view-locals.middleware';
import { AccessMiddleware } from './middleware/access.middleware';
import { User } from './modules/access/models/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      envFilePath:
        process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'authLimiter', ttl: 900000, limit: 10 }, // 10 req / 15 min
      { name: 'otpLimiter', ttl: 900000, limit: 5 }, // 5 req / 15 min
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rawType = config.get<string>('DB_TYPE', 'better-sqlite3');
        const dbType = (
          rawType === 'sqlite' ? 'better-sqlite3' : rawType
        ) as any;
        const dbName =
          config.get<string>('DB_DATABASE') ||
          config.get<string>('DB_NAME', 'nestadmin.sqlite');
        const isMemory = dbName === ':memory:';
        const isSqliteLike = dbType === 'better-sqlite3';
        const baseOpts = {
          entities: [join(__dirname, 'modules/**/*.entity{.ts,.js}')],
          migrations: [join(__dirname, 'modules/**/migrations/*{.ts,.js}')],
          synchronize: false as const,
          migrationsRun: config.get('NODE_ENV') === 'test',
          logging: config.get('NODE_ENV') === 'development',
        };
        if (isSqliteLike) {
          return {
            ...baseOpts,
            type: dbType,
            database: isMemory ? ':memory:' : join(process.cwd(), dbName),
          };
        }
        return {
          ...baseOpts,
          type: dbType,
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 3306),
          username:
            config.get<string>('DB_USERNAME') ||
            config.get<string>('DB_USER', 'root'),
          password:
            config.get<string>('DB_PASSWORD') ||
            config.get<string>('DB_PASS', ''),
          database: config.get<string>('DB_DATABASE') || dbName,
        };
      },
    }),
    // Needed by AccessMiddleware (fresh DB query per request)
    TypeOrmModule.forFeature([User]),
    // StorageModule is @Global() — exports StorageService everywhere
    StorageModule,
    // SettingModule is @Global() — exports SettingCacheService everywhere
    SettingModule,
    AuthModule,
    AccessModule,
    ProfileModule,
    DashboardModule,
    ComponentsModule,
    HomeModule,
    MediaModule,
  ],
  providers: [ViewLocalsMiddleware, AccessMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ViewLocalsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
    consumer
      .apply(AccessMiddleware)
      .forRoutes({ path: '/admin/v1/*', method: RequestMethod.ALL });
  }
}
