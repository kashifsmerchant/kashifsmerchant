# Promise-to-Proof

A case can be marked resolved while the corrected invoice is still a draft. Promise-to-Proof lets a service owner follow a commitment from the original promise to the exact document, access grant, and delivery receipt that fulfill it.

[Open the demo](https://promise-to-proof-kashif.ksm5351.chatgpt.site) · [Project portfolio](https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site/about)

## Try two cases

1. Open Northstar Studio. The service case says “Resolved.” The invoice has the right amount, but its publication record is missing. Stage and apply publication, grant access, then simulate delivery. Each action changes the evidence for that step. When the last condition passes, the case is verified and the missed deadline remains visible.
2. Open Copperfield Goods. A message was posted but its receipt is missing from the review. Stage “Retrieve existing receipt” to reconcile the simulated provider record. The original delivery time is preserved and the message count stays the same.

Select a source reference to inspect its event. Use the status filters to find other cases, export a JSON review of the current workspace, or reset the original fixtures.

## What counts as evidence

Each fictional commitment specifies a customer, transaction, invoice, approved amount, edition requirement, delivery address, and deadline. The demo checks the saved content, publication, customer access, and delivery receipt separately. Only records from the relevant simulated system qualify. The case-management status is shown alongside those checks. Recipient acknowledgement is a separate fact for which the fixture has no source.

The fixtures include a wrong amount, an old-version receipt, an open deadline, and duplicated and out-of-order events. Correcting the content creates a new edition. Its publication, access, and delivery must be proved again. Repeating an already applied repair leaves the workspace unchanged. When dispatch history is uncertain, the engine calls for investigation.

## Run locally

Serve the static application with Python 3 from this project directory.

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. The app runs in the browser using fictional fixtures and a fixed simulation clock. Actions update the in-memory copy. Reloading the page restores the fixtures. No accounts, API keys, or package installs are required.

Run the behavior tests with Node.js 22 or newer.

```sh
node --test tests/engine.test.mjs
```

The evaluation and repair functions live in `dist/engine.mjs`. The browser interface lives in `dist/app.mjs`. The exported review records the simulation time, real export time, individual assessments, and underlying events.

## License

MIT. Copyright 2026 Kashif Merchant.
