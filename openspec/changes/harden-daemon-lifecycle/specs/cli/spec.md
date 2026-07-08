# cli spec delta

## ADDED Requirements

### Requirement: ServeTokenAtRestIsOwnerOnly

The serve daemon SHALL write its discovery descriptor (`.openlore/serve.json`), which can carry
the daemon auth token, with owner-only permissions (0o600, enforced by an explicit chmod after
write so the process umask cannot widen it). The token is the credential that separates "any
local process" from authorized callers; it SHALL never rest world-readable. This is the
write-side complement of `harden-serve-descriptor-trust`, which hardens reading an untrusted
descriptor.

#### Scenario: The descriptor is not world-readable

- **GIVEN** a daemon started with a token (flag or environment)
- **WHEN** `serve.json` is written
- **THEN** its file mode is 0o600 regardless of umask; on platforms without POSIX modes the
  limitation is disclosed, not silently ignored

### Requirement: ServeStartIsSingleInstanceUnderRace

Daemon startup SHALL hold an exclusive-create lockfile across the discover-probe → bind →
write-descriptor window, so two concurrent starts for one root (for example, two MCP clients
racing through `ensureServeDaemon`) resolve to exactly one daemon: the loser reuses the winner's
descriptor instead of binding a second port, running a second watcher on the same analysis
directory, or orphaning the first daemon by overwriting its descriptor. The lock reuses the
existing decisions-lock exclusive-create shape, including stale-lock recovery.

#### Scenario: Two concurrent starts yield one daemon

- **GIVEN** two processes calling daemon startup for the same root at the same moment
- **WHEN** both run the single-instance check concurrently
- **THEN** exactly one binds and writes the descriptor; the other returns the winner's endpoint;
  exactly one watcher runs on the analysis directory

#### Scenario: A crashed starter does not wedge future starts

- **GIVEN** a starter that died while holding the lock
- **WHEN** a later start finds the stale lockfile
- **THEN** the stale lock is detected and recovered (the decisions-lock discipline) and startup
  proceeds

### Requirement: ServeTeardownDrainsInFlightRebuilds

Daemon teardown SHALL await any in-flight forced rebuild before the process exits, with a bounded
wait whose expiry is disclosed rather than silent; and the idle self-shutdown reaper SHALL be
suppressed while a rebuild is in flight, so a daemon is never reaped or hard-exited mid-rebuild,
leaving a logically half-rebuilt store.

#### Scenario: SIGTERM during a rebuild exits cleanly

- **GIVEN** a daemon mid-way through a triggered `analyze --force`
- **WHEN** it receives SIGTERM
- **THEN** teardown waits for the rebuild to finish (or discloses that the bounded wait expired)
  before `process.exit`, and the store reconciles healthy afterward

#### Scenario: A long rebuild does not look idle

- **GIVEN** a daemon with no incoming requests whose rebuild outlasts the idle window
- **WHEN** the idle timer would fire
- **THEN** the reaper is suppressed until the rebuild completes, then idle accounting resumes
