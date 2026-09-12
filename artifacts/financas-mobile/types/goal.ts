import type {
  Goal as ApiGoal,
  GoalInput as ApiGoalInput,
  GoalUpdate as ApiGoalUpdate,
} from '@workspace/api-client-react';

export type Goal = ApiGoal;
export type NewGoalInput = ApiGoalInput;
export type GoalUpdate = ApiGoalUpdate;