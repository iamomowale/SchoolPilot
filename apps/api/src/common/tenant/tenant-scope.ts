export function tenantScope(tenantId: string) {
  return {
    tenantId,
    deletedAt: null,
  };
}

export function canAccessTenant(currentTenantId: string, recordTenantId: string) {
  return currentTenantId === recordTenantId;
}
