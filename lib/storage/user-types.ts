import type { ProviderKind } from "./credential-types";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  authProvider: ProviderKind;
}

export interface UpsertUserParams {
  id?: string;
  email: string;
  name: string;
  organization?: string | null;
  authProvider: ProviderKind;
}
