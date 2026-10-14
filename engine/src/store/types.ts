export interface TenantContext {
  tenantId: string;
  actor: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  type: string;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface BlobStore {
  put(ctx: TenantContext, data: string | Uint8Array): Promise<string>;
  get(ctx: TenantContext, sha256: string): Promise<Uint8Array | null>;
}

export interface AuditLog {
  append(ctx: TenantContext, type: string, data: Record<string, unknown>): Promise<AuditEntry>;
  list(ctx: TenantContext): Promise<AuditEntry[]>;
  verify(ctx: TenantContext): Promise<boolean>;
}
