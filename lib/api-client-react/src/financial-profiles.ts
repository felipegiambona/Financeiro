import { customFetch } from "./custom-fetch";

export type FinancialProfileType = "personal" | "business";

export interface FinancialProfile {
  id: string;
  type: FinancialProfileType;
  name: string;
  businessName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialProfileInput {
  type: FinancialProfileType;
  name: string;
  businessName?: string;
}

export async function listFinancialProfiles(): Promise<FinancialProfile[]> {
  return customFetch<FinancialProfile[]>("/api/financial-profiles", { method: "GET", responseType: "json" });
}

export async function createFinancialProfile(input: FinancialProfileInput): Promise<FinancialProfile> {
  return customFetch<FinancialProfile>("/api/financial-profiles", {
    method: "POST",
    responseType: "json",
    body: JSON.stringify(input),
  });
}

export async function deleteFinancialProfile(profileId: string): Promise<void> {
  await customFetch(`/api/financial-profiles/${profileId}`, {
    method: "DELETE",
    responseType: "text",
  });
}