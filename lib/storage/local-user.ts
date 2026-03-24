import type { StoredUser } from "./user-types";

export const ELECTRON_LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";
export const ELECTRON_LOCAL_USER_EMAIL = "local@lumen.app";
export const ELECTRON_LOCAL_USER_NAME = "User";

export function isElectronRuntime(): boolean {
  return !!process.env.ELECTRON;
}

export function buildDefaultElectronUser(): StoredUser {
  return {
    id: ELECTRON_LOCAL_USER_ID,
    email: ELECTRON_LOCAL_USER_EMAIL,
    name: ELECTRON_LOCAL_USER_NAME,
    organization: null,
    authProvider: "openai_auth",
  };
}
