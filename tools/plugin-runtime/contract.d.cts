export interface RuntimePackage {
  formatVersion: 1;
  pluginId: string;
  version: string;
  requires: { clientApi: 1; uiApi: 0 | 1 };
  entrypoints: { client?: string; ui?: string; styles?: string[] };
  files: { path: string; size: number; sha256: string }[];
  signature?: { algorithm: 'ed25519'; keyId: string; value: string };
}
export const API_VERSION: 1;
export const MAX_FILES: number;
export const MAX_FILE_BYTES: number;
export const MAX_PACKAGE_BYTES: number;
export const idPattern: RegExp;
export function runtimePath(value: unknown): string;
export function canonical(value: unknown): string;
export function signedPayload(manifest: RuntimePackage): string;
export function validatePackage(value: unknown): RuntimePackage;
export function packageRoot(pluginId: string, revision: string): string;
