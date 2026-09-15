import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPreviousStep,
  initialStepForProfile,
  normalizeStepForProfile,
  resolveOnboardingStep,
} from '../components/onboardingState.ts';

test('inicia o perfil pessoal sem carteira na etapa de nome', () => {
  assert.equal(initialStepForProfile('personal'), 'name');
  assert.equal(resolveOnboardingStep({
    storedStep: null,
    profileType: 'personal',
    walletCount: 0,
  }), 'name');
});

test('inicia o perfil empresarial sem carteira diretamente na etapa de carteira', () => {
  assert.equal(initialStepForProfile('business'), 'wallet');
  assert.equal(resolveOnboardingStep({
    storedStep: null,
    profileType: 'business',
    walletCount: 0,
  }), 'wallet');
});

test('normaliza nome e perfil salvos apenas para o perfil empresarial', () => {
  for (const step of ['name', 'profile']) {
    assert.equal(normalizeStepForProfile(step, 'business'), 'wallet');
    assert.equal(normalizeStepForProfile(step, 'personal'), step);
  }
});

test('retoma metas, limites e cartões já alcançados', () => {
  for (const step of ['goal', 'limit', 'card']) {
    assert.equal(resolveOnboardingStep({
      storedStep: step,
      profileType: 'personal',
      walletCount: 1,
    }), step);
    assert.equal(resolveOnboardingStep({
      storedStep: step,
      profileType: 'business',
      walletCount: 1,
    }), step);
  }
});

test('não permite que um perfil empresarial volte para as etapas pessoais ao navegar para trás', () => {
  assert.equal(getPreviousStep('wallet', 'wallet'), null);
  assert.equal(getPreviousStep('goal', 'wallet'), 'wallet');
  assert.equal(getPreviousStep('limit', 'wallet'), 'goal');
  assert.equal(getPreviousStep('card', 'wallet'), 'limit');
});