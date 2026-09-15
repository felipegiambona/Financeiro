---
name: Transaction month totals
description: Business rule for the total shown at the bottom of the transactions screen.
---

The total at the bottom of the transactions screen represents only the launches listed for the selected month. The separate card invoice summary shown below the total must not be included; card-linked transactions in the launch list are still launches and count once.

**Why:** The invoice card is a summary of the card activity and is not a separate launch. Including it would make the bottom total disagree with the list immediately above it.

**How to apply:** Calculate the total from the filtered launches only, including card-linked expense launches once. Keep the total immediately above the invoice section and independent from invoice amounts.