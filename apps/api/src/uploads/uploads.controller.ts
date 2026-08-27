import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Post, Query, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PermissionGuard } from '../authorization/permission.guard';
import { PermissionKeys } from '../authorization/permissions';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { TenantGuard } from '../authorization/tenant.guard';
import { UploadDocumentDto } from './dto';
import { UploadedBinary, UploadsService } from './uploads.service';

const maxUploadBytes = 10 * 1024 * 1024;

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(TenantGuard, PermissionGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('students/:studentId/photo')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  @ApiOperation({ summary: 'Upload a validated private JPEG or PNG student photo (maximum 5MB)' })
  @ApiResponse({ status: 400, description: 'Invalid, mismatched, or oversized file.' })
  async studentPhoto(@Req() req: Request, @Param('studentId') studentId: string, @UploadedFile() file?: UploadedBinary) { return { success: true, data: await this.uploads.uploadStudentPhoto(this.tenant(req), this.user(req), studentId, this.file(file)) }; }

  @Post('documents')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: maxUploadBytes, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { kind: { type: 'string', enum: ['student_document', 'school_document'] }, studentId: { type: 'string' }, file: { type: 'string', format: 'binary' } }, required: ['kind', 'file'] } })
  @ApiOperation({ summary: 'Upload a permitted private PDF, JPEG, or PNG student or school document (maximum 10MB)' })
  async document(@Req() req: Request, @Body() dto: UploadDocumentDto, @UploadedFile() file?: UploadedBinary) { return { success: true, data: await this.uploads.uploadDocument(this.tenant(req), this.user(req), dto.kind, dto.studentId, this.file(file)) }; }

  @Post(':id/signed-download-url')
  @RequirePermission(PermissionKeys.REPORT_VIEW)
  @ApiOperation({ summary: 'Create a short-lived signed URL for an authorized private upload' })
  async signedUrl(@Req() req: Request, @Param('id') id: string) { return { success: true, data: await this.uploads.signedDownloadUrl(this.tenant(req), this.user(req), id) }; }

  @Delete(':id')
  @RequirePermission(PermissionKeys.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Delete a private upload and its tenant metadata with audit logging' })
  async delete(@Req() req: Request, @Param('id') id: string) { return { success: true, data: await this.uploads.delete(this.tenant(req), this.user(req), id) }; }

  private file(file?: UploadedBinary) { if (!file) throw new ForbiddenException('A file is required'); return file; }
  private tenant(req: Request) { const id = req.headers['x-tenant-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing tenant context'); return id; }
  private user(req: Request) { const id = req.headers['x-user-id'] as string | undefined; if (!id) throw new ForbiddenException('Missing user context'); return id; }
}

@ApiTags('uploads')
@Controller('uploads/signed')
export class SignedUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Get(':id')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({ summary: 'Download a private object using an unexpired signed URL; no file listing is available' })
  @ApiProduces('application/octet-stream')
  async download(@Param('id') id: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res({ passthrough: true }) response: Response) {
    const { upload, buffer } = await this.uploads.downloadSigned(id, expires, signature);
    response.setHeader('Content-Type', upload.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${upload.originalName.replace(/"/g, '')}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(buffer);
  }
}
