import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { OBJECT_STORAGE, ObjectStorageAdapter } from './object-storage.types';

export type UploadedBinary = { originalname: string; mimetype: string; size: number; buffer: Buffer };
type UploadKind = 'student_photo' | 'student_document' | 'school_document';

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageAdapter) {}

  async uploadStudentPhoto(tenantId: string, userId: string, studentId: string, file: UploadedBinary) { return this.upload(tenantId, userId, 'student_photo', studentId, file); }

  async uploadDocument(tenantId: string, userId: string, kind: 'student_document' | 'school_document', studentId: string | undefined, file: UploadedBinary) {
    if (kind === 'student_document' && !studentId) throw new BadRequestException('studentId is required for a student document');
    if (kind === 'school_document' && studentId) throw new BadRequestException('School documents cannot be attached to a student');
    return this.upload(tenantId, userId, kind, studentId, file);
  }

  async signedDownloadUrl(tenantId: string, userId: string, id: string) {
    const upload = await this.accessibleUpload(tenantId, userId, id);
    await this.audit.log({ tenantId, userId, action: 'sign-download', entityType: 'uploaded-file', entityId: id, details: `Signed ${upload.kind} download URL` });
    return { id: upload.id, expiresInSeconds: Number(process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || '300'), url: this.storage.createSignedDownloadUrl(upload.storageKey, Number(process.env.UPLOAD_SIGNED_URL_TTL_SECONDS || '300')) };
  }

  async downloadSigned(id: string, expires: string, signature: string) {
    const upload = await this.prisma.uploadedFile.findFirst({ where: { id, deletedAt: null } });
    if (!upload || !this.storage.verifySignedDownloadUrl(upload.storageKey, expires, signature)) throw new ForbiddenException('Invalid or expired download URL');
    return { upload, buffer: await this.storage.get(upload.storageKey) };
  }

  async delete(tenantId: string, userId: string, id: string) {
    const upload = await this.accessibleUpload(tenantId, userId, id);
    await this.storage.delete(upload.storageKey);
    const deleted = await this.prisma.uploadedFile.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ tenantId, userId, action: 'delete', entityType: 'uploaded-file', entityId: id, details: `Deleted ${upload.kind} ${upload.originalName}` });
    return deleted;
  }

  private async upload(tenantId: string, userId: string, kind: UploadKind, studentId: string | undefined, file: UploadedBinary) {
    this.validateFile(kind, file);
    if (studentId) {
      const student = await this.prisma.studentProfile.findFirst({ where: { id: studentId, tenantId, deletedAt: null }, select: { id: true } });
      if (!student) throw new NotFoundException('Student not found');
    }
    if (kind === 'school_document' && !(await this.authorization.isSchoolAdmin(userId, tenantId))) throw new ForbiddenException('Only school administrators can upload school documents');
    const id = randomUUID();
    const extension = this.extension(file.mimetype);
    const storageKey = `${tenantId}/${id}.${extension}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    try {
      const upload = await this.prisma.uploadedFile.create({ data: { id, tenantId, studentId, uploadedById: userId, kind, originalName: this.safeName(file.originalname), contentType: file.mimetype, sizeBytes: file.size, storageKey } });
      await this.audit.log({ tenantId, userId, action: 'upload', entityType: 'uploaded-file', entityId: upload.id, details: `Uploaded ${kind} ${upload.originalName}` });
      return upload;
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  private async accessibleUpload(tenantId: string, userId: string, id: string) {
    const upload = await this.prisma.uploadedFile.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!upload) throw new NotFoundException('Uploaded file not found');
    if (upload.uploadedById === userId || await this.authorization.isSchoolAdmin(userId, tenantId)) return upload;
    if (upload.studentId) {
      const [student, guardian] = await Promise.all([
        this.prisma.studentProfile.findFirst({ where: { id: upload.studentId, tenantId, userId, deletedAt: null }, select: { id: true } }),
        this.prisma.guardianProfile.findFirst({ where: { tenantId, userId, deletedAt: null, studentGuardians: { some: { studentId: upload.studentId, deletedAt: null } } }, select: { id: true } }),
      ]);
      if (student || guardian) return upload;
    }
    throw new ForbiddenException('You are not authorized to access this file');
  }

  private validateFile(kind: UploadKind, file: UploadedBinary) {
    if (!file?.buffer?.length || !file.originalname || file.size !== file.buffer.length) throw new BadRequestException('A complete file is required');
    const maxBytes = kind === 'student_photo' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    const allowed = kind === 'student_photo' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'];
    if (file.size > maxBytes) throw new BadRequestException(`File exceeds the ${maxBytes / (1024 * 1024)}MB limit`);
    if (!allowed.includes(file.mimetype) || !this.hasExpectedSignature(file.buffer, file.mimetype)) throw new BadRequestException('File type is not permitted or its content does not match its declared type');
  }

  private hasExpectedSignature(file: Buffer, contentType: string) { if (contentType === 'image/jpeg') return file.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])); if (contentType === 'image/png') return file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); return file.subarray(0, 5).toString('ascii') === '%PDF-'; }
  private extension(contentType: string) { return contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'pdf'; }
  private safeName(name: string) { return name.replace(/[\\/\0\r\n]/g, '_').slice(0, 255) || 'upload'; }
}
