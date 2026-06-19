# Dogfood — widen-js-function-node-extraction (2026-06-18)

Real-input, end-to-end verification of the widened TS/JS function-node extraction, run with the
**built CLI** (`dist/cli/index.js`, `npm run build`) against real third-party source — not fixtures.

## 1. Express 5.2.1 `lib/` (real npm tarball)

```
npm pack express@^5   →   express-5.2.1.tgz   →   tar xzf
openlore init && openlore analyze . --no-embed   (161 functions)
```

Internal nodes per file (`sqlite3 .openlore/analysis/call-graph.db`):

| file | nodes | before (proposal estimate) |
|------|-------|----------------------------|
| `lib/response.js`    | 29 | ~handful |
| `lib/application.js` | 18 | **~2** |
| `lib/utils.js`       | 9  | |
| `lib/request.js`     | 8  | |
| `lib/view.js`        | 5  | |
| `lib/express.js`     | 2  | |

`application.js` nodes now include the member methods that were previously invisible:
`app.use`, `app.handle`, `app.set`, `app.listen`, `app.route`, `app.param`, `app.render`,
`app.engine`, `app.init`, `app.defaultConfiguration`, `app.enable/disable/enabled/disabled`,
`app.all`, `app.path`, plus the module-scope helpers `logerror`, `tryRender`.

`response.js`: `res.send`, `res.json`, `res.jsonp`, `res.cookie`, `res.download`, `res.format`,
`res.get`, `res.header`, `res.append`, `res.attachment`, `res.clearCookie`, … (29 total).

**Edges now resolve through member methods** (impossible before — the enclosing function wasn't a
node, so every call site inside it was dropped):
- internal: `app.render → tryRender`, `res.sendFile → sendfile`
- outward: `res.send → setCharset/get/isBuffer/byteLength/etagFn`, `res.json → get`, `res.jsonp → …`

**Negative case holds.** `lib/express.js` is almost entirely `exports.X = require(...)` /
`exports.X = proto` / `exports.json = bodyParser.json`. It produced exactly **2** nodes —
`createApplication` (a real function) and `app` (a `var`-bound function expression). None of the
`require(...)` / member-access / identifier RHS assignments were indexed.

## 2. Django-admin jQuery-plugin idiom

Faithful reproduction of the `$.fn.djangoAdminSelect2 = function(){}` plugin + a CommonJS prototype
class. Extracted nodes:

```
$.fn.djangoAdminSelect2     ← the formset:added handler, previously NOT indexed
Widget
Widget.prototype.render
Widget.prototype.template
init
```

The plugin handler the proposal called out (the one that made `formset:added` resolve only 1 of 2
handlers) is now a first-class node available to the event-synthesis rules.

## 2b. Class-field arrow handlers (`public_field_definition` arm, decision `efcd981c`)

The dominant modern handler idiom — `class C { handler = () => {} }` — was the one common shape the
first cut of this change did not reach (it is a `public_field_definition`, not a `method_definition`
or any binding/assignment). Added as a follow-up arm and dogfooded two ways with the built CLI:

**Real third-party corpus — mobx 6.16.1 `src/` (57 real `.ts` files, npm tarball):** **398** internal
nodes, of which **144** are class members (`method_definition` + the new field arm) — `Atom.onBO`,
`ComputedValue.computeValue_`, `ComputedValue.get`, … — **zero** with a malformed (paren/space-bearing)
name. No node explosion, no regression. (One pre-existing artifact noted below, unrelated to this arm.)

**Faithful React class-component reproduction (`src/Counter.tsx`, analyzed on disk):**

```
class Counter extends Component {
  increment = () => { …; track('increment'); this.persist(); };  // field arrow
  decrement = (): void => { …; track('decrement'); };            // typed field arrow
  persist   = () => { track('persist'); };                       // field arrow
  reset     = function reset() { track('reset'); };              // field function expression
  render() { … }                                                 // method (pre-existing arm)
}
```

All four field handlers are now indexed as `Counter.increment` / `.decrement` / `.persist` / `.reset`
with className `Counter`, and **every handler's outward edge resolves** (`Counter.increment → track`,
`… decrement/persist/reset → track`). Before this arm, none of the four were nodes, so none of those
edges existed. (`this.persist()` stays unresolved — intra-class `this.method()` resolution is a
separate, pre-existing limitation, not introduced here.)

**Pre-existing artifact observed (NOT this arm, not a regression):** mobx's `src/api/action.ts`
contains TypeScript that tree-sitter-typescript cannot fully parse (`hasError: true`); under
error-recovery the *existing* `assignment_expression` arm emitted one garbage-named node spanning two
no-semicolon statements (`createDecoratorAnnotation(actionBoundAnnotation)autoAction.bound`). It comes
from the member-assignment arm shipped in the first cut, only fires on a parse error, and is out of
scope for this follow-up. Worth a future guard (skip nodes whose subtree `hasError`).

## 3. Adversarial fixture

| source | indexed? |
|--------|----------|
| `obj[key] = function(){}` (computed member) | **no** (correct) |
| `obj.maybe ||= function(){}` (augmented)     | **no** (correct) |
| `exports.a = exports.b = function(){}` (chained) | only `exports.b` (correct — outer RHS is an assignment, not a function) |
| `function control(){}` | yes |
| `{ method(){}, prop: function(){} }` | `method` only (existing `method_definition`; `pair` value out of scope) |

## 4. Node-explosion / name-quality sanity (this repo's `src/`)

Re-analyzed a copy of OpenLore's own `src/` with the new build: **1979 internal nodes** — no
explosion. The only node names containing whitespace are six **pre-existing** Ansible YAML fixtures
(`task:…`, `handler:…`); the JS/TS change introduced none. A real member node (`r.onload`) extracts
cleanly.

## 5. Suite

`vitest run src`: **185 files, 3872 passed / 2 skipped / 0 failed** (9 new tests over the v2.1.0
baseline of 3863). `typecheck` + `eslint` clean.

**0 functional bugs found.**
