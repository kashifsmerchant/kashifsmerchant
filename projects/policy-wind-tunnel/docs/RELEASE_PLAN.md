# Agentic product portfolio release plan

## Authorization and scope

The user authorized building and deploying the project series, beginning with Policy Wind Tunnel and Decision Replay, followed by a release every two days. The user also requested a polished public profile/description page and limited public source to these projects.

This is an execution plan for autonomous build runs. A future run should implement, verify, save source, and deploy the next release. It should not merely remind the user to build it.

The initial sequence covers the six selected concepts in five releases because Decision Replay ships with Policy Wind Tunnel. Additional ideas remain an unscheduled backlog.

| Target date | Release | Scope |
| --- | --- | --- |
| November 21, 2026 | Policy Wind Tunnel + Decision Replay | Policy comparison, implementation disagreement, case evidence, and repair regression |
| November 23, 2026 | Promise-to-Proof | Verify customer commitments against observable evidence |
| November 25, 2026 | Undo Plan | Plan, execute, and verify conditional recovery |
| November 27, 2026 | Workstream Rebuilder | Evaluate an operating-model change and its queue effects |
| November 29, 2026 | Workflow Compiler | Convert a demonstrated task into an editable, testable specification |

The scheduling timezone is `America/Chicago`. Use the actual automation configuration for the run time. These are target release dates, not evidence that a release has shipped.

## Durable release registry

The owning build agent maintains `docs/RELEASE_REGISTRY.json` in the durable source repository. Use it as the authoritative record of completed work and external identifiers.

Recommended fields per release:

```json
{
  "slug": "policy-wind-tunnel",
  "title": "Policy Wind Tunnel with Decision Replay",
  "targetDate": "2026-11-21",
  "status": "planned",
  "siteProjectId": null,
  "sourceRepository": null,
  "commitSha": null,
  "savedVersionId": null,
  "deploymentId": null,
  "liveUrl": null,
  "verification": [],
  "completedAt": null,
  "blocker": null
}
```

Record the real timestamps, source commit, test results, and returned deployment state. Preserve opaque provider IDs exactly. Keep credentials out of the registry and all committed files. Do not invent completed states, test results, or publication dates.

If a release has already been deployed successfully, verify its registry entry and do not create a duplicate Site or repository. If a previous run stopped midway, resume it from the recorded identifiers and source state.

## Shared product standard

Each release should have:

1. A clear business decision or outcome that the product helps someone handle.
2. A credential-free demo using fictional entities and repeatable fixtures.
3. Actual interactive behavior, including an important failure or boundary case.
4. Clear labels for reference, simulated, recorded, and live execution modes where applicable.
5. Accessible, responsive presentation with understandable errors and empty states.
6. A README with setup instructions, behavior, limitations, and a license.
7. Meaningful tests around consequential behavior, followed by browser verification when available.
8. Pushed source and a confirmed deployment with its literal returned URL.
9. An updated public profile card only after the release exists and is verified.

Use the established slate, white, and coral visual direction unless a particular product warrants a carefully explained departure. Use plain language. Do not use em dashes. Public copy must not claim that planned work is already shipped or that fictional results are production outcomes.

## Release 1: Policy Wind Tunnel with Decision Replay

### User outcome

A policy owner can understand which cases change under a proposed policy and which implementation profiles disagree with the approved expectation.

### Scope

- Fictional return-policy workspace.
- Editable policy controls for window, effective date, partial returns, approval threshold, and receipt evidence.
- Reference support agent, refund API, and reviewer procedure with deliberate version and effective-date differences.
- Comparison table, filters, case evidence, and rule traces.
- Broad repair versus effective-date-aware repair.
- Case replay and reviewable export.
- Public profile page describing only this project series.

### Acceptance

The correct repair aligns the supported implementation profiles with the expectation. The broad repair exposes at least one historical regression. Missing evidence remains unknown. Imported records cannot silently become valid decisions through unsafe coercion. Results are reproducible from the saved inputs and configuration.

## Release 2: Promise-to-Proof

### User outcome

A service owner can distinguish a case marked resolved from a customer commitment that has actually been fulfilled.

### Scope

Create a fictional case-management workspace with commitments for corrected invoices. Each commitment includes customer and transaction identifiers, deadline, required document, approved amount, delivery destination, and required evidence.

Provide three simulated evidence sources: case records, document state, and message delivery records. Support observable conditions such as correct content persisted, document published, customer access present, and delivery recorded. Keep posting, delivery, and recipient acknowledgement distinct.

The application should explain the exact unmet condition and stage a supported remediation. Evidence checks should use the reference records rather than an agent’s narrative claim that the task is complete.

### Required demo cases

- Resolved case with a draft-only document.
- Published document inaccessible to the customer.
- Delivered document containing an incorrect amount or version.
- Correct document and access with missing delivery evidence.
- Complete commitment with authoritative evidence.
- Duplicate and out-of-order events.
- A deadline not yet reached, where missing evidence is unverified rather than automatically failed.

### Acceptance

Only fulfilled acceptance conditions produce verified completion. Duplicate events do not double-count work. Out-of-order events are reconciled against the current evidence. Unsupported acknowledgement remains unobservable. Remediation is explicit and does not duplicate consequential actions.

## Release 3: Undo Plan

### User outcome

A builder can inspect the recovery behavior of a proposed action and safely recover eligible changes without overwriting subsequent legitimate edits.

### Scope

Build a small SDK plus a visual reference workspace for bulk case or customer-record updates. Each supported action should carry its resource ID, before-state, expected version, recovery operation, eligibility conditions, residual effects, and recovery postcondition.

Classify actions as conditionally reversible, compensable, reversible until a deadline, irreversible, or unsupported. Use tested recovery functions for the supported actions. A prose description alone must not count as verified recovery coverage.

### Required demo cases

- Bulk update followed by successful recovery.
- Some records receive new legitimate edits after the original change.
- A recovery operation fails and remains visibly unresolved.
- A duplicate retry does not repeat a consequential change.
- An outbound message is staged before its irreversible boundary.

### Acceptance

Only eligible records are recovered automatically. New edits are preserved. Conflict cases are reviewable. Recovery success is based on verified resulting state. Residual effects and unsupported operations remain visible. No real message, payment, or customer change is sent by the credential-free demo.

## Release 4: Workstream Rebuilder

### User outcome

An operations lead can compare an existing workstream with a proposed redesign and see its effect on throughput, delay, specialist demand, and exceptions.

### Scope

Use synthetic case arrivals and an explicit event or discrete-event simulation model for a service workflow. Model working calendars, processing time, finite review capacity, queue discipline, rework, and exception rates. Keep assumptions editable and distinguish them from observed fixture values.

Support a bounded intervention set such as automated classification, removing a redundant approval, changing escalation criteria, or adding specialist capacity. Display before-and-after outcomes and a pilot plan with measurable success and reversal conditions.

### Required demo cases

- Faster initial classification overloads the specialist queue.
- Removing a redundant step improves the entire workflow.
- An attractive average hides a worse tail of long-running cases.
- A proposed improvement is sensitive to an uncertain exception rate.

### Acceptance

The baseline model can reproduce the supplied reference events within documented tolerances. Calculations respond correctly to capacity and arrival constraints. The interface does not present hypothetical predictions as measured production savings. A proposal includes a testable pilot, not only a diagram.

## Release 5: Workflow Compiler

### User outcome

An operations specialist can demonstrate one task and obtain a workflow draft that exposes the rules, assumptions, and missing branches before execution.

### Scope

Record real interactions inside a supported fictional application. Compile those observed events into a constrained editable workflow with inputs, actions, decision points, policy references, expected outcomes, stop conditions, and acceptance tests.

Distinguish observed behavior, policy-supported rules, human-confirmed decisions, and unresolved assumptions. Ask a bounded clarification when a demonstration cannot distinguish plausible rules. Execute only the supported action vocabulary in the reference environment.

### Required demo cases

- One successful refund demonstration with ambiguous eligibility.
- Human clarification changes the specification and its tests.
- Unseen boundary and missing-data cases.
- A policy change invalidates an identified rule and dependent tests.
- An unsupported branch stops with a useful explanation.

### Acceptance

The system records actual supported interactions and produces an executable artifact. It does not pretend one example establishes every business rule. Unresolved assumptions constrain execution. Policy changes affect the dependent steps and tests. The scope of supported recording and execution is clearly stated.

## Public source and profile scope

Publish only independent source for these projects. Do not include unrelated repository contents, employer materials, user financial or health data, private documents, or credentials. Do not link unrelated repositories from the public profile.

Use a separate source repository and Site for each standalone release when supported. The combined Wind Tunnel and Replay release can share one repository. The owning agent should handle any GitHub profile changes and repository-visibility work as a separate, explicitly reviewed scope.

For each new Site, inspect the local hosting manifest and release registry before creation. Reuse a recorded `project_id`. Persist newly returned IDs before continuing. Preserve the selected audience and follow the authorized public-project scope.

## Future run procedure

1. Load this plan and the durable release registry from the current source repository.
2. Identify the earliest incomplete scheduled release and inspect any partial work.
3. Read applicable project instructions and the relevant development/hosting skill.
4. Implement the supported release, delegating independent work where useful.
5. Validate behavior, inspect the interface, and fix observed failures.
6. Prepare and push the exact source state used for the deployment artifact.
7. Deploy and check the returned status until it is terminal.
8. Record the source commit, actual checks, deployment identifiers, URL, and completion time.
9. Update the public profile with the verified live project link and accurate status.
10. Report the completed release or a concrete blocker. Never report success from a planned URL or an unverified build.

If external access or an approval gate blocks completion, preserve the work and record the exact blocker. Do not change permissions or unrelated resources to evade a gate.

## Unscheduled backlog

Work Deletion Lab, Context ROI Lab, Impossible Work Detector, Agent Traffic Controller, Human Attention Planner, and Agent Audition remain ideas for later evaluation. They are not part of the five-release schedule and should not be represented as shipped products.
