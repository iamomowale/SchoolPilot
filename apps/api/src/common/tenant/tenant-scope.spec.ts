import { canAccessTenant, tenantScope } from './tenant-scope';

describe('tenantScope', () => {
  it('scopes records to the active tenant and excludes soft-deleted rows', () => {
    expect(tenantScope('tenant-a')).toEqual({
      tenantId: 'tenant-a',
      deletedAt: null,
    });
  });

  it('denies access when the current tenant does not match the record tenant', () => {
    expect(canAccessTenant('tenant-a', 'tenant-b')).toBe(false);
    expect(canAccessTenant('tenant-a', 'tenant-a')).toBe(true);
  });
});
