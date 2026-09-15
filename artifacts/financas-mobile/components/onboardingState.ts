export type OnboardingStep = 'name' | 'profile' | 'wallet' | 'goal' | 'limit' | 'card';
export type OnboardingProfileType = 'personal' | 'business';

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['name', 'profile', 'wallet', 'goal', 'limit', 'card'];

export function isOnboardingStep(value: string | null): value is OnboardingStep {
  return value !== null && ONBOARDING_STEPS.includes(value as OnboardingStep);
}

export function initialStepForProfile(profileType: OnboardingProfileType): OnboardingStep {
  return profileType === 'business' ? 'wallet' : 'name';
}

export function normalizeStepForProfile(
  step: OnboardingStep,
  profileType: OnboardingProfileType,
): OnboardingStep {
  if (profileType === 'business' && (step === 'name' || step === 'profile')) {
    return 'wallet';
  }
  return step;
}

export function resolveOnboardingStep({
  storedStep,
  profileType,
  walletCount,
}: {
  storedStep: string | null;
  profileType: OnboardingProfileType;
  walletCount: number;
}): OnboardingStep {
  const fallbackStep = walletCount === 0 ? initialStepForProfile(profileType) : 'wallet';
  const savedStep = isOnboardingStep(storedStep) ? storedStep : fallbackStep;
  const normalizedStep = normalizeStepForProfile(savedStep, profileType);

  return normalizedStep === 'wallet' && walletCount > 0 ? 'goal' : normalizedStep;
}

export function getPreviousStep(step: OnboardingStep, initialStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = ONBOARDING_STEPS.indexOf(step);
  const previousIndex = currentIndex - 1;
  const firstStepIndex = initialStep === 'wallet' ? ONBOARDING_STEPS.indexOf('wallet') : 0;
  return previousIndex >= firstStepIndex ? ONBOARDING_STEPS[previousIndex] : null;
}