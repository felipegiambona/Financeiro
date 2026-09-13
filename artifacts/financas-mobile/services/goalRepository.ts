import {
  createGoalMovement as createGoalMovementRequest,
  createGoal as createGoalRequest,
  deleteGoal as deleteGoalRequest,
  getGoal as getGoalRequest,
  listGoals,
  updateGoal as updateGoalRequest,
} from '@workspace/api-client-react';
import type { Goal, GoalDetail, GoalMovement, GoalMovementInput, GoalUpdate, NewGoalInput } from '@/types/goal';

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

export async function getGoal(id: string): Promise<GoalDetail> {
  return getGoalRequest(id) as Promise<GoalDetail>;
}

export async function createGoalMovement(id: string, input: GoalMovementInput): Promise<GoalMovement> {
  return createGoalMovementRequest(id, {
    ...input,
    ...(input.description === undefined ? {} : { description: input.description.trim() }),
  }) as Promise<GoalMovement>;
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