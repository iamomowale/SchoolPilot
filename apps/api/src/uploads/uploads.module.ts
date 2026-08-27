import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaService } from '../common/prisma.service';
import { OBJECT_STORAGE } from './object-storage.types';
import { PrivateLocalStorageAdapter } from './private-local-storage.adapter';
import { SignedUploadsController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [UploadsController, SignedUploadsController],
  providers: [UploadsService, PrivateLocalStorageAdapter, { provide: OBJECT_STORAGE, useExisting: PrivateLocalStorageAdapter }, PrismaService],
})
export class UploadsModule {}
