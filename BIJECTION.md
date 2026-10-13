# @bijectionhq/daytona

This is a maintained fork of daytona/integrations at `4f10159a3ae5faa31792bb59abaa52aeecb5546c`.
The package keeps inherited validators, function references, serialization, and
transaction behavior. Its SDK imports resolve through the application's single
`bijection` installation. Sandbox records and low-level provider actions remain owned by this component.
Those actions do not acquire native agent recovery or authority merely by
being imported.

Every inherited difference is checked by the same Concave source in Bijection.
Mechanical module and public identifier changes have explicit recipes in
`concave.json`. Runtime symbols and validator markers are never rebranded.
Semantic changes require narrow `concave:begin` / `concave:end` fences with
`why`, `witness`, `preserves`, and `remove-when`, followed by a recorded binding.
Never approve an entire source file to avoid explaining its changed invariants.

Run `just concave check`, then the selected build and tests. Land through
`scripts/land.py`; it refuses source-parity regressions. Upstream updates use
ordinary merge commits, followed by inspection and narrowly justified repairs.
Original examples and documentation are retained for comparison; they do not
advertise Bijection's native authority, billing, or recovery guarantees.
GitHub Actions are disabled. Verification is explicit and local.

## Sandbox outbound networking

The host-facing create options accept `networkBlockAll` and forward it on the
original provider creation request. Omission preserves provider defaults; an
explicit false remains false. This is a configuration request, not proof of
firewall enforcement. The native agent binding must separately verify that the
selected provider account can enforce its required policy before admission.
Daytona documents the account-tier restriction in its
[network limits](https://www.daytona.io/docs/en/network-limits/).

## Provider execution evidence

An execution has three independent facts. The inherited `status` records local
supervision (`running`, `completed`, `failed`, `cancelled`). `outcome` records
provider command evidence (`not_dispatched`, `unconfirmed`, `exited`); an `exited`
command retains the provider's actual exit code. `cleanup` records a pending
session deletion or its acknowledgement. A delete acknowledgement establishes
neither command exit nor complete sandbox/child-process teardown.

The component records possible command delivery before transmission and the
stable background session before creation. Lost replies, invalid completions,
and failed supervision retain uncertainty. Never retry a command because its
action failed. `daytona.retryCleanup(ctx, { executionId })` retries only a retained
terminal session deletion; it never dispatches code. Purge retains uncertain
outcomes and pending cleanup. Host applications still enforce authorization.
These records are component bookkeeping, not native agent admission, protected
output custody or an external-call receipt.

Every HTTP request and its body share a ten-minute deadline, matching the
inherited action ceiling rather than shortening a valid long-running command. Actual response
bytes are limited to 8 MiB before JSON/text/binary decoding; error details are
limited to 2,000 bytes. Oversize and deadline refusals preserve command
uncertainty. No missing exit code becomes a successful zero.

Run `BIJECTION_PLATFORM_ROOT=/path/to/bijection python3 scripts/check_daytona_custody.py`
for the fork's source-bound TypeScript and single-worker component checks.
The check uses the platform's pinned Node and installed SDK graph; it is a
mocked-provider/component witness, not PostgreSQL crash recovery or live Daytona
qualification. Native agents keep the platform's durable run and authority owner.

## Creation lifetime

`ttlMinutes` forwards the provider wall-clock lifetime at creation. Omission
preserves provider defaults; zero disables TTL. Invalid integers are refused
before allocation. This option does not establish a native lease or verified
cleanup. A native binding must inspect the provider's actual `autoDestroyAt`
and preserve the original deadline on recovery. The provider's relative
`setTtl` re-anchors its deadline and is not a safe retry substitute.

The reviewed client source is `daytona/clients` at
`151cb7103a1cf7fd21fddcddc50ad4eade3a9e26` (`sdk-typescript/src/Daytona.ts`
and `Sandbox.ts`); see the [provider TTL contract](
https://www.daytona.io/docs/en/typescript-sdk/sandbox/#setttl).
