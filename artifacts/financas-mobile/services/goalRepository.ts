import {
  createGoal as createGoalRequest,
  deleteGoal as deleteGoalRequest,
  listGoals,
  updateGoal as updateGoalRequest,
} from '@workspace/api-client-react';
import type { Goal, GoalUpdate, NewGoalInput } from '@/types/goal';

export async function getGoals(): Promise<Goal[]> {
  return listGoals() as Promise<Goal[]>;
}

export async function createGoal(input: NewGoalInput): Promise<Goal> {
  return createGoalRequest({
    ...input,
    title: input.title.trim(),
    imageData: input.imageData ?? null,
    deadline: input.deadline ?? null,
  }) as Promise<Goal>;
}

export async function updateGoal(id: string, updates: GoalUpdate): Promise<Goal> {
  return updateGoalRequest(id, {
    ...updates,
    ...(updates.title === undefined ? {} : { title: updates.title.trim() }),
  }) as Promise<Goal>;
}

export async function deleteGoal(id: string): Promise<void> {
  await deleteGoalRequest(id);
}