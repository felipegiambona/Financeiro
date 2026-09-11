import {
  createLimit as createLimitRequest,
  deleteLimit as deleteLimitRequest,
  listLimits,
  updateLimit as updateLimitRequest,
} from '@workspace/api-client-react';
import type { Limit, NewLimitInput, LimitUpdate } from '@/types/limit';

export async function getLimits(): Promise<Limit[]> {
  return listLimits() as Promise<Limit[]>;
}

export async function createLimit(input: NewLimitInput): Promise<Limit> {
  return createLimitRequest({
    ...input,
    description: input.description?.trim() || null,
  }) as Promise<Limit>;
}

export async function updateLimit(id: string, updates: LimitUpdate): Promise<Limit> {
  return updateLimitRequest(id, {
    ...updates,
    ...(updates.description === undefined ? {} : { description: updates.description?.trim() || null }),
  }) as Promise<Limit>;
}

export async function deleteLimit(id: string): Promise<void> {
  await deleteLimitRequest(id);
}