---
name: Investment quote provider fallback
description: External quote-provider behavior for Brazilian stocks, FIIs, and ETFs.
---

BRAPI can return `401 MISSING_TOKEN` for individual B3 tickers even when other tickers work without a token. Market assets need a second provider path so a provider-specific authentication response does not turn a valid automatic investment into a permanent quote error.

**Why:** The automatic quote for KISU11 failed through BRAPI while direct Yahoo Finance chart data was available.

**How to apply:** Try BRAPI first for stock, FII, and ETF quotes, then fall back to Yahoo Finance using the `.SA` symbol. Preserve the last stored value if both providers fail.