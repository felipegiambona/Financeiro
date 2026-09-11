import type {
  Limit as ApiLimit,
  LimitInput as ApiLimitInput,
  LimitPeriod as ApiLimitPeriod,
  LimitUpdate as ApiLimitUpdate,
} from '@workspace/api-client-react';

export type Limit = ApiLimit;
export type LimitPeriod = ApiLimitPeriod;
export type NewLimitInput = ApiLimitInput;
export type LimitUpdate = ApiLimitUpdate;

export const LIMIT_PERIODS: Array<{ value: LimitPeriod; label: string }> = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'bimonthly', label: 'Bimestral' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
];