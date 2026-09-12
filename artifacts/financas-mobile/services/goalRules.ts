import type { Transaction } from '@/types/transaction';
import type { Goal } from '@/types/goal';

export function calculateGoalSavedAmount(goal: Goal, transactions: Transaction[]): number {
  return Math.max(
    transactions.reduce((total, transaction) => {
      if (transaction.goalId !== goal.id || transaction.paymentStatus !== 'paid') return total;
      if (transaction.type === 'income') return total + transaction.amount;
      if (transaction.type === 'expense') return total - transaction.amount;
      return total;
    }, 0),
    0,
  );
}

export function calculateGoalProgress(goal: Goal, transactions: Transaction[]) {
  const savedAmount = calculateGoalSavedAmount(goal, transactions);
  const percentage = goal.targetAmount > 0 ? (savedAmount / goal.targetAmount) * 100 : 0;
  return {
    savedAmount,
    percentage,
    progress: Math.min(percentage / 100, 1),
    remaining: Math.max(goal.targetAmount - savedAmount, 0),
  };
}