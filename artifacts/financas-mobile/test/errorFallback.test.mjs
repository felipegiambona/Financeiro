import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorFallback } from '../components/ErrorFallback.tsx';

test('renders the fallback without app providers', () => {
  const error = new Error('provider-free failure');
  error.stack = 'Error: provider-free failure\n    at isolated test';

  const markup = renderToStaticMarkup(
    React.createElement(ErrorFallback, {
      error,
      resetError: () => {},
    }),
  );

  assert.match(markup, /Something went wrong/);
  assert.match(markup, /Please reload the app to continue\./);
  assert.match(markup, /Try Again/);
  assert.match(markup, /Error Details/);
  assert.match(markup, /Error: provider-free failure/);
  assert.match(markup, /at isolated test/);
});

test('keeps contextual hooks out of the provider-free fallback', () => {
  const source = fs.readFileSync(new URL('../components/ErrorFallback.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /from ['"](?:@\/)?(?:context|hooks)\//);
  assert.doesNotMatch(source, /\buse(?:Theme|Colors|SafeAreaInsets|Auth)\b/);
});