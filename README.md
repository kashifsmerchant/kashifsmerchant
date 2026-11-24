<p align="center">
  <img src="assets/banner.svg" width="100%" alt="Kashif Merchant — Product leader building agentic applications, platforms, and teams. Decisions you can inspect. Changes you can test. Outcomes you can verify.">
</p>

<p align="center">
  <a href="#current-project"><b>Current project</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#the-series"><b>The series</b></a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#how-i-approach-the-work"><b>Approach</b></a>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/kashifsmerchant/"><img src="https://img.shields.io/badge/LinkedIn-kashifsmerchant-0A66C2?style=flat-square" alt="LinkedIn: kashifsmerchant"></a>
  <a href="https://kashifmerchant.com/"><img src="https://img.shields.io/badge/Website-kashifmerchant.com-D95631?style=flat-square" alt="Website: kashifmerchant.com"></a>
</p>

<br>

I build teams from the ground up and bring product, engineering, and operations together around real work. My focus is the judgment a useful agent needs:

> **Which decisions can it make on its own?**<br>
> **When should a person take over?**<br>
> **What evidence does that person need to assess the result?**

These independent projects make that judgment tangible. Each one uses a fictional workspace and repeatable cases, so you can inspect the behavior for yourself.

<br>

## Current project

<a href="https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site">
  <img src="assets/policy-wind-tunnel.png" width="100%" alt="Policy Wind Tunnel: a proposed return policy on the left, three implementations on the right (support agent, refund API, reviewer procedure), and summary cards showing 36 cases compared, 20 disagreements, 6 historical regressions, and 3 cases with missing evidence.">
</a>

### Policy Wind Tunnel &nbsp;<sub>with Decision Replay</sub>

**See what a policy change actually changes.** Change a business policy and see where its implementations disagree. Inspect the evidence behind a decision, test a repair, and check whether the repair breaks another case.

<p>
  <a href="https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site"><img src="https://img.shields.io/badge/Open_the_live_demo-D95631?style=for-the-badge" alt="Open the live demo"></a>
  <a href="https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site/about.html"><img src="https://img.shields.io/badge/Project_profile-17242A?style=for-the-badge" alt="Read the project profile"></a>
  <a href="https://github.com/kashifsmerchant/kashifsmerchant/tree/main/projects/policy-wind-tunnel"><img src="https://img.shields.io/badge/Source-17242A?style=for-the-badge&logo=github&logoColor=white" alt="Inspect the source"></a>
</p>

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/icon-compare.svg" width="40" height="40" alt=""><br>
      <b>Compare</b><br>
      Adjust the return window, effective date, partial returns, approval limit, and receipt rule. See the expected decision next to an agent, an API, and a reviewer procedure.
    </td>
    <td width="33%" valign="top">
      <img src="assets/icon-inspect.svg" width="40" height="40" alt=""><br>
      <b>Inspect</b><br>
      Filter to disagreements or missing evidence. Open any decision to see its facts, the policy version that applied, and the rule trace.
    </td>
    <td width="33%" valign="top">
      <img src="assets/icon-repair.svg" width="40" height="40" alt=""><br>
      <b>Repair</b><br>
      Try a fix and check it against historical cases for regressions. Replay any case under any implementation, then export the review.
    </td>
  </tr>
</table>

<a href="https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site">
  <img src="assets/decision-comparison.png" width="100%" alt="The decision comparison table. Each case shows the expected outcome next to the support agent, refund API, and reviewer procedure, with disagreements highlighted. The case evidence panel explains why RET-001 should be approved and notes that two implementations disagree.">
</a>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES_modules-1D2A32?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="JavaScript ES modules">
  <img src="https://img.shields.io/badge/Node.js-built--in_test_runner-1D2A32?style=flat-square&logo=nodedotjs&logoColor=5FA04E" alt="Node.js built-in test runner">
  <img src="https://img.shields.io/badge/dependencies-none-20704F?style=flat-square" alt="No dependencies">
  <img src="https://img.shields.io/badge/API_keys-not_required-20704F?style=flat-square" alt="No API keys required">
  <img src="https://img.shields.io/badge/license-MIT-65717B?style=flat-square" alt="MIT license">
</p>

<br>

## The series

Five working tools, each built around one product question.

| | Project | The question it answers | Status |
|:-:|:--|:--|:-:|
| **01** | **[Policy Wind Tunnel](https://policy-wind-tunnel-kashif.ksm5351.chatgpt.site)**<br><sub>Compare a policy change across every implementation, then test the repair.</sub> | *What does a policy change actually change?* | ![Live](https://img.shields.io/badge/live-20704F?style=flat-square) |
| **02** | **[Promise-to-Proof](https://promise-to-proof-kashif.ksm5351.chatgpt.site)**<br><sub>Trace a corrected invoice from a support case to its delivery receipt. [View source](https://github.com/kashifsmerchant/kashifsmerchant/tree/main/projects/promise-to-proof).</sub> | *Did the right customer receive the promised invoice?* | ![Live](https://img.shields.io/badge/live-20704F?style=flat-square) |
| **03** | **Undo Plan**<br><sub>Make recovery an inspectable, executable part of an action.</sub> | *Can this change be recovered?* | ![Planned](https://img.shields.io/badge/planned-65717B?style=flat-square) |
| **04** | **Workstream Rebuilder**<br><sub>Test operating changes across the whole workflow, including the queues and exceptions they create.</sub> | *Does the whole workflow improve?* | ![Planned](https://img.shields.io/badge/planned-65717B?style=flat-square) |
| **05** | **Workflow Compiler**<br><sub>Turn a demonstrated task into an editable workflow with explicit rules, assumptions, and tests.</sub> | *What did the demonstration leave out?* | ![Planned](https://img.shields.io/badge/planned-65717B?style=flat-square) |

<sub>Planned projects get live links once their releases are built and verified.</sub>

<br>

## How I approach the work

| 01 · Start with the decision | 02 · Make uncertainty visible | 03 · Verify the outcome |
|:--|:--|:--|
| Define the outcome, the person accountable for it, and the evidence they need to make a useful choice. | Show what the system observed, what it inferred, and what still needs a person’s judgment. | Check the resulting state. Keep explanations connected to evidence, and make failure cases easy to inspect. |

<br>

---

<p align="center">
  <sub>All examples in this series are fictional. The source is independent work and contains no employer code or customer data.</sub>
</p>
