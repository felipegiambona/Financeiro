import type {
  Goal as ApiGoal,
  GoalInput as ApiGoalInput,
  GoalDetail as ApiGoalDetail,
  GoalHistoryEntry as ApiGoalHistoryEntry,
  GoalMovement as ApiGoalMovement,
  GoalMovementInput as ApiGoalMovementInput,
  GoalUpdate as ApiGoalUpdate,
} from '@workspace/api-client-react';

export type Goal = ApiGoal;
export type NewGoalInput = ApiGoalInput;
export type GoalUpdate = ApiGoalUpdate;
export type GoalDetail = ApiGoalDetail;
export type GoalHistoryEntry = ApiGoalHistoryEntry;
export type GoalMovement = ApiGoalMovement;
export type GoalMovementInput = ApiGoalMovementInput;