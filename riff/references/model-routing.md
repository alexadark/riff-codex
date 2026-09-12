# RIFF model routing

This is the canonical routing policy. Routing is optional and never a quota.

| Work | Model | Reasoning | Speed |
| --- | --- | --- | --- |
| Mechanical inventory and exact extraction | GPT-5.6 Luna Light | `low` | Fast when exposed |
| Repeatable execution needing stronger verification | GPT-5.6 Luna XHigh | `xhigh` | Fast when exposed |
| Bounded implementation across several files | GPT-5.6 Luna XHigh | `xhigh` | Fast when exposed |
| Normal judgment, product discovery, synthesis | GPT-5.6 Sol Medium | `medium` | Default |
| Small isolated UI adjustment | GPT-5.6 Sol Medium | `medium` | Default |
| Focused visual implementation and iterative refinement | GPT-5.6 Sol High | `high` | Default |
| Cross-surface design system or major visual redesign | GPT-5.6 Sol XHigh | `xhigh` | One bounded root wave |
| Exceptional multi-system architecture decision | GPT-5.6 Sol XHigh | `xhigh` | One bounded pass |
| Exceptional problem after XHigh failed | GPT-5.6 Sol Max | `max` | Last resort |

For `$riff:start`, use Luna Light with Fast for repository inventory, Sol Medium for the interview and normal architecture, at most one bounded Sol XHigh pass for a genuinely multi-system decision, and Luna XHigh with Fast when mechanical artifact normalization benefits from delegation.

A roadmap phase whose core outcome is a cross-surface design system or major visual redesign may run at the root with Sol XHigh so one model owns the visual system and reconciles it across the product. Use Sol High for later focused implementation or visual iteration, and Sol Medium for small isolated UI changes. Browser mechanics may use the appropriate Luna route, but final visual direction and acceptance remain with the routed Sol tier in the primary task.

Outside that design-specific exception, do not run the root task with Sol XHigh and do not create a custom root architect. When native spawning cannot select Fast separately, keep Luna and record `fast_available: false` in the wave event. Use the smallest sufficient context for every subagent.
