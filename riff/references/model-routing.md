# RIFF model routing

This is the canonical routing policy. Routing is optional and never a quota.

| Work | Model | Reasoning | Speed |
| --- | --- | --- | --- |
| Mechanical inventory, exact extraction and artifact normalization | GPT-5.6 Luna | `xhigh` | Fast when exposed |
| Bounded implementation and repeatable verification | GPT-5.6 Luna | `xhigh` | Fast when exposed |
| Planning, product discovery, architecture, synthesis and final judgment | GPT-6 Astra | `medium` | Default |
| Visual direction, design decisions and visual acceptance | GPT-6 Astra | `medium` | Default |
| Complex judgment or diagnosis unresolved at Medium | GPT-6 Astra | `high` | One bounded pass |
| Exceptional complexity unresolved at High | GPT-6 Astra | `xhigh` | One bounded pass |

Use Astra Medium in the primary task for planning, decomposition, decisions, integration and final acceptance. Use Luna XHigh for mechanical work with a clear scope and observable checks, including inventories and browser mechanics. Implementation requiring unresolved product, architecture or design decisions returns to Astra before mechanical execution continues.

For `$riff:start`, use Astra Medium for the interview, planning and architecture, and Luna XHigh for repository inventory and mechanical artifact normalization when delegation adds value. The same division applies to visual work: Astra owns direction and acceptance; Luna can execute a defined change and collect browser evidence.

Escalate Astra from Medium to High only for a concrete difficulty, then to XHigh if High remains insufficient. Record the reason and keep the escalation bounded; a large phase or redesign alone does not justify higher effort. Return to Medium once the difficult decision is resolved. Sol, Terra, Luna Low and Max are not part of the default routing policy.

When native spawning cannot select Fast separately, keep Luna and record `fast_available: false` in the wave event. Use the smallest sufficient context for every subagent. This policy does not itself switch the active model or authorize delegation beyond the current task's instructions.
