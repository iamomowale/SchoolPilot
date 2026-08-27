import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../authorization/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../common/prisma.service';
import { ObjectStorageAdapter } from './object-storage.types';
import { UploadedBinary, UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const prisma = {
    studentProfile: { findFirst: jest.fn() },
    guardianProfile: { findFirst: jest.fn() },
    uploadedFile: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const authorization = { isSchoolAdmin: jest.fn() };
  const audit = { log: jest.fn() };
  const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn(), createSignedDownloadUrl: jest.fn(), verifySignedDownloadUrl: jest.fn() };
  let service: UploadsService;

  const jpeg = (overrides: Partial<UploadedBinary> = {}): UploadedBinary => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    return { originalname: 'photo.jpg', mimetype: 'image/jpeg', size: buffer.length, buffer, ...overrides };
  };

  beforeEach(() => {
    service = new UploadsService(prisma as unknown as PrismaService, authorization as unknown as AuthorizationService, audit as unknown as AuditService, storage as ObjectStorageAdapter);
    jest.clearAllMocks();
  });

  it('rejects a photo whose bytes do not match its declared image type before storage', async () => {
    await expect(service.uploadStudentPhoto('tenant-1', 'user-1', 'student-1', jpeg({ buffer: Buffer.from('%PDF-not-an-image'), size: 17 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects a photo above the 5MB limit before storage', async () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    Buffer.from([0xff, 0xd8, 0xff]).copy(buffer);
    await expect(service.uploadStudentPhoto('tenant-1', 'user-1', 'student-1', jpeg({ buffer, size: buffer.length }))).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rejects school-document uploads by a non-administrator', async () => {
    authorization.isSchoolAdmin.mockResolvedValue(false);

    await expect(service.uploadDocument('tenant-1', 'user-1', 'school_document', undefined, jpeg())).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('does not grant a signed URL to an unrelated tenant user', async () => {
    prisma.uploadedFile.findFirst.mockResolvedValue({ id: 'file-1', tenantId: 'tenant-1', studentId: 'student-1', uploadedById: 'uploader-1', storageKey: 'tenant-1/file-1.jpg', kind: 'student_photo' });
    authorization.isSchoolAdmin.mockResolvedValue(false);
    prisma.studentProfile.findFirst.mockResolvedValue(null);
    prisma.guardianProfile.findFirst.mockResolvedValue(null);

    await expect(service.signedDownloadUrl('tenant-1', 'other-user', 'file-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.createSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('stores tenant metadata and audits a valid student photo upload', async () => {
    prisma.studentProfile.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.uploadedFile.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);

    const upload = await service.uploadStudentPhoto('tenant-1', 'user-1', 'student-1', jpeg());

    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^tenant-1\/.+\.jpg$/), expect.any(Buffer), 'image/jpeg');
    expect(upload).toEqual(expect.objectContaining({ tenantId: 'tenant-1', studentId: 'student-1', uploadedById: 'user-1', kind: 'student_photo' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'upload', tenantId: 'tenant-1' }));
  });
});
