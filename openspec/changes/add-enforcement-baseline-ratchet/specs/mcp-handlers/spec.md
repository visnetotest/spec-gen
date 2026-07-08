# mcp-handlers spec delta

## ADDED Requirements

### Requirement: EnforcementBaselineRatchet

The enforcement policy SHALL support a fourth categorical class, `frozen`, alongside
`blocking | advisory | off`. When a finding code is mapped `frozen`, the first gate run SHALL
record its existing findings into a plain-text, human-readable, VCS-committable baseline under
`.openlore/`, one line per finding identity — identity being the stable `code` plus `subject`
(plus a stable discriminator where needed), never the message or a file:line, so matching is
line-number-insensitive by construction. Subsequent runs SHALL block only on findings absent from
the baseline, reporting baselined findings as frozen and disclosing the ratchet state (frozen
count, new count) in every gate result. A baseline entry whose finding no longer fires SHALL be
removed automatically on the next run, so a fixed violation cannot silently return. A baseline
SHALL be written only under an explicit `frozen` policy mapping, and a policy downgrade to
`advisory` SHALL leave the baseline in place while ceasing to block. The class is categorical: no
new tuning constant is introduced.

#### Scenario: Brownfield adoption blocks only new debt

- **GIVEN** a repository with 312 pre-existing findings for a code the operator maps to `frozen`
- **WHEN** the gate runs, and later a change introduces 2 findings not in the baseline
- **THEN** the first run freezes the 312 without blocking, and the later run blocks on exactly
  the 2, disclosing "312 frozen, 2 new → blocked on the 2"

#### Scenario: The ratchet prevents regressions from returning

- **GIVEN** a frozen finding that a developer fixes
- **WHEN** the next gate run removes its baseline line, and a later change re-introduces the same
  finding
- **THEN** the re-introduced finding is not in the baseline and blocks — it cannot re-enter the
  freeze silently

#### Scenario: Moving a frozen violation does not un-freeze it

- **GIVEN** a baselined finding whose subject moves to a different line within its file
- **WHEN** the gate re-runs
- **THEN** the finding still matches its baseline entry (identity is code + subject, not
  file:line) and remains frozen

#### Scenario: Downgrading the policy preserves the frozen record

- **GIVEN** a code mapped `frozen` with a committed baseline
- **WHEN** the operator downgrades the code to `advisory`
- **THEN** the gate stops blocking on that code, the baseline file is left untouched, and a later
  re-upgrade to `frozen` resumes against the ratcheted baseline
