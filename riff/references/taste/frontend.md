# Frontend taste

Goal: an intentional, coherent interface that helps its users complete the promised task. Working components and a passing build are insufficient evidence of good design.

## Direction before implementation

Inspect the current rendered interface, design references, components and tokens relevant to the task. Preserve exact-parity requirements and an approved visual system. For a new surface, establish a concise direction in project frontend taste: audience and main action, information hierarchy, layout/density, type scale, semantic colors, component language, imagery and restrained motion. Make these choices autonomously from the goal in loop mode. Avoid a generic card grid, decorative gradients or copied starter styling without a product reason.

Use realistic content and the actual primary workflow to shape the composition. Carry the same direction across related screens, responsive layouts and loading, empty, error and success states. Reuse accessible primitives while adapting their composition to the product; a component library is not a finished design.

## Required skill use

Before substantive frontend work, discover and read the available design skills needed by the changed surface. Apply them during implementation and review, not just mention their names afterward.

| Changed concern | Skills to read and apply |
| --- | --- |
| New screen, major redesign or whole-flow review | `better-interface`, plus its applicable domain skills below |
| Structure, hierarchy, spacing, responsive composition | `better-layout` |
| Type scale, wrapping, readability and text density | `better-typography` |
| Palette, semantic tokens, contrast, themes | `better-colors` |
| Components, optical alignment, icons and motion | `better-ui` |
| Keyboard, focus, semantics, forms and reduced motion | `better-accessibility` |
| Labels, instructions, empty states and errors | `better-writing` |

For a new screen or substantial redesign, all six domains apply. A focused correction loads only affected domains. Run their review in the current RIFF task; skill routing does not require subagents or a separate review bureaucracy.

Resolve skills from the current catalog and project instructions first. On Alexandra's machine, the user-owned canonical fallback is `~/DEV/claude-code-private/skills/design/<skill-name>/SKILL.md`; read the file and required references directly when it exists. Respect manual invocation policies. Do not assume changing directories exposes skills, install global copies, or edit plugin caches. On another machine, use available equivalent design skills; if unavailable, apply this baseline, report the missing capability, and never claim those skills ran.

Also use the installed stack-specific skills when relevant: shadcn for those components, the applicable React review skill after its trigger, and image-generation/media skills when actual visual assets serve the design. Check the actual router and runtime: a React app is not automatically Next.js. Do not load every installed skill or invent dependencies to satisfy this table.

## Visual acceptance

Use the installed browser automation capability to inspect the changed screen with screenshots and exercise its primary interaction. For layout changes, inspect representative desktop and narrow/mobile widths with realistic content, including overflow and long labels. For interaction changes, check the affected loading, empty, error, success, disabled, focus and keyboard states; include theme/reduced-motion behavior when changed.

Compare the rendered result with the approved reference or recorded direction. Correct visible hierarchy, spacing, typography, contrast, clipping and interaction defects before the candidate's final review. Retest only the affected checks. Record the route, viewport, state and screenshot/evidence location with the normal functional review; distinguish visual judgment from automated checks.

If browser or required application access is missing, continue independent work but mark rendered acceptance unverified and use the operating contract's access/verification boundary. Do not declare visual completion from JSX, a DOM snapshot, HTTP 200 or a build alone. A minor copy edit does not justify a full-site redesign or an exhaustive browser matrix.
