import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NOTIFICATION_PACKAGES, normalizeNotificationPackages } from '../services/notificationPackages.ts';

test('mantém os aplicativos preparados na lista padrão', () => {
  assert.ok(DEFAULT_NOTIFICATION_PACKAGES.includes('com.nu.production'));
  assert.ok(DEFAULT_NOTIFICATION_PACKAGES.includes('br.com.bb.investimentos'));
  assert.equal(new Set(DEFAULT_NOTIFICATION_PACKAGES).size, DEFAULT_NOTIFICATION_PACKAGES.length);
});

test('normaliza pacotes sem permitir vazios ou duplicados', () => {
  assert.deepEqual(
    normalizeNotificationPackages([' com.nu.production ', '', 'com.nu.production', null, 'br.com.intermedium']),
    ['com.nu.production', 'br.com.intermedium'],
  );
});