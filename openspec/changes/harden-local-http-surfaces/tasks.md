# Tasks — harden local HTTP surfaces

## Implementation
- [ ] Extract serve.ts guard (Host allowlist, Origin check, constant-time token, non-loopback
      token requirement) into a shared module; serve.ts imports it (behavior-identical)
- [ ] Apply guard to all view.ts /api/* routes; inject token into the served UI page
- [ ] /api/chat requires token even on loopback
- [ ] view.ts SIGINT/SIGTERM graceful shutdown + descriptor file (stale-instance detection)

## Verification
- [ ] Rebinding-shaped request (loopback IP, foreign Host/Origin) → 403 on every view API route
- [ ] Served UI same-origin flow works end-to-end (chat, skeleton, search)
- [ ] /api/chat without token → 401 even from localhost
- [ ] serve daemon suite unchanged and green against the shared module

## Spec
- [ ] `mcp-security` delta: ADD AllLocalHttpSurfacesShareTheGuard
