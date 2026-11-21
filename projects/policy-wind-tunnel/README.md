# Policy Wind Tunnel

With Decision Replay. An independent project by Kashif Merchant.

Change a business policy, compare the resulting decisions, and inspect where different implementations disagree. Then test a repair against both the failing case and the rest of the case set.

The first release uses a fictional retailer and a return-policy change. It is a working, browser-based reference environment with a deterministic policy engine. It does not call a live language model, a customer system, or an external decision API.

## What you can do

- Change the return window, policy effective date, partial-return rule, automatic approval threshold, and receipt requirement.
- Compare the approved expectation with three reference implementations representing a support agent, a refund API, and a reviewer procedure.
- Filter changed outcomes, implementation disagreements, and cases with insufficient evidence.
- Inspect the facts, applicable policy version, and rule trace behind an individual decision.
- Try a broad repair, then check whether it changes historical cases incorrectly.
- Replay a selected case under a chosen implementation.
- Import your own supported case records and export a reviewable result bundle.

The reference implementations deliberately contain different policy versions and an effective-date defect. These are inspectable test fixtures, not claims about any production vendor or employer system.

## Run it locally

No account, API key, dependency installation, or build step is required for the reference demo.

```bash
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000` for the application or `http://localhost:8000/about.html` for the public project profile.

The source includes native JavaScript ES modules, so serve it over HTTP rather than opening `index.html` directly from the file system.

## Run the engine tests

Use a recent Node.js version with the built-in test runner:

```bash
node --test tests/*.test.mjs
```

The tests cover policy boundaries, effective dates, missing evidence, partial returns, approval thresholds, and implementation disagreement. The browser UI and deployment require their own verification.

## The example policy

The baseline policy has a 30-day return window, does not allow partial returns, and routes amounts over $100 for review. The proposed policy has a 45-day window, permits partial returns, and raises the automatic approval threshold to $150. Both initially require a receipt.

The proposed policy applies according to the purchase date and its configured effective date. Earlier purchases retain the baseline policy. Elapsed return days are computed from the purchase and request dates as whole UTC calendar days.

An unknown result means the reference environment lacks enough valid evidence to decide. The demo keeps that state separate from approval, denial, and human review.

## Supported case format

```json
{
  "id": "CASE-001",
  "customer": "Jordan Vale",
  "orderId": "ORD-1001",
  "purchaseDate": "2026-11-02",
  "requestDate": "2026-12-07",
  "amount": 64,
  "itemsReturned": 1,
  "totalItems": 1,
  "receipt": true,
  "condition": "unopened",
  "note": "Fictional case inside the proposed window."
}
```

Dates use `YYYY-MM-DD`. Receipt values can be `true`, `false`, or `null` when evidence is unavailable. The engine validates inputs and retains incomplete cases as unknown where evaluation cannot proceed. See the application’s import guidance for the supported collection shape and CSV headings.

## Why build this

A policy document, a customer-facing agent, a backend service, and a staff procedure can disagree about the same case. A release review should make those disagreements visible before someone relies on the result.

This project explores three product questions:

1. Can a policy owner see the consequences of a change without inspecting implementation code?
2. Can an investigator connect a result to the facts and rules that produced it?
3. Can a repair be checked for regressions, especially when historical policies still apply?

The interface is designed around those decisions. The deterministic reference environment makes every result reproducible and its limits visible.

## Implementation

```text
dist/
  index.html       Application shell
  styles.css       Application styling
  app.mjs          UI, import/export, and replay interactions
  engine.mjs       Policy evaluation and cross-implementation comparison
  fixtures.mjs     Fictional cases and scenario definitions
  about.html       Public profile and project descriptions
  about.css        Public profile styling
tests/
  engine.test.mjs  Behavioral tests
docs/
  ARCHITECTURE.md  Interfaces, evaluation semantics, and extension boundaries
  RELEASE_PLAN.md  Scope and acceptance criteria for the project series
  PROFILE.md       Public profile copy
```

## Extending it

An actual agent or business service can be added through an explicit adapter that accepts the supported case facts and returns a decision with evidence. Keep that integration distinct from the reference implementation, and record the execution mode in exported results.

The architecture notes describe the boundary. No live-model integration is included in this release.

Before using the system for operational decisions, replace the fictional policy with approved business semantics, validate the case coverage, and test the actual implementation being evaluated. Synthetic case frequency does not estimate production incident frequency.

## Data and scope

All bundled names, orders, and events are fictional. This repository contains independent work and no employer source code, customer records, private business policies, or proprietary architecture.

The project profile features only this public project series. Planned projects are explicitly labeled and do not have live links until verified releases exist.

## License

MIT. Copyright 2026 Kashif Merchant. See `LICENSE`.
