# System-managed RIFF hooks on macOS

Codex supports lifecycle hooks in `/etc/codex/requirements.toml`. Managed hooks are trusted by policy, so their definitions do not require individual user approval. This is distinct from RIFF's recorded approval checksum and the CLI's invocation-only trust bypass.

The machine installation uses:

- `/etc/codex/requirements.toml`: the six RIFF lifecycle definitions and `features.hooks = true`.
- `/etc/codex/riff/managed-dispatch.mjs`: a root-owned dispatcher.
- `/etc/codex/riff/installation.json`: the selected user, project directory, canonical framework path, Node executable and installed-file hashes.

The dispatcher runs as the current user, not as root. It invokes only the selected canonical RIFF checkout, for initialized projects whose `.riff-codex` resolves to that checkout, within the configured project directory. Other repositories and other users produce no RIFF action. Vendored or separately installed framework copies require their own explicit setup; they are not silently trusted.

Do not set `allow_managed_hooks_only = true`: that would disable unrelated project, user and plugin hooks. Preserve existing requirements and foreign hook entries. Administrative installation must review and merge any existing system policy, install root-owned files, and publish the TOML only after the dispatcher and its configuration are present. The selected RIFF checkout is trusted for subsequent updates; the dispatcher must never select executable code from an arbitrary repository.

When this policy is installed with matching hashes, `init` and `resync` remove only RIFF's duplicate project hook definitions and preserve foreign hooks. The two Git hook wrappers remain installed. `doctor` reports policy configuration without manufacturing an approval record. If the policy is absent or no longer matches, `resync` restores ordinary project hooks and their standard trust workflow.

After installation, reload the desktop application's configuration or restart it. Verify the app's effective hook listing reports the six hooks as managed and enabled. Exercise a normal event in an initialized RIFF project and check a non-RIFF project remains unaffected. Configuration on disk alone is not proof that an already-running session has reloaded it.

If Node is moved or removed, update its explicit path in the machine installation. If the dispatcher or TOML is changed, refresh the installation receipt after review. Updating the ordinary canonical RIFF implementation does not require rewriting hook definitions.

Sources: [Hook trust and managed hooks](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks), [desktop managed configuration](https://learn.chatgpt.com/docs/enterprise/managed-configuration).
