# Code Review

Review the current files against project rules. Report violations with file path and line number.

## Checklist

### Universal
- [ ] Any file > 250 lines? (> 150 for Angular UI primitives in `shared/ui/`)
- [ ] Barrel exports (`index.ts` re-exporting)?
- [ ] Any real auth logic (must remain a stub)?
- [ ] Missing `manifest.yaml` or missing `tier` field?

### Backend (Python/FastAPI)
- [ ] Layer boundary violations? (repo importing router, service importing router)
- [ ] Missing type hints on any function?
- [ ] Raw integer HTTP status codes instead of `status.HTTP_XXX`?
- [ ] Routes missing `/api/` prefix?
- [ ] Sync SQLAlchemy session instead of `AsyncSession`?
- [ ] Column defined without `Mapped[]` / `mapped_column()`?
- [ ] Pydantic schema missing `model_config = {"from_attributes": True}`?
- [ ] Manual DB changes instead of Alembic migration?

### Frontend (Angular)
- [ ] NgModule used?
- [ ] `@Input()` or `@Output()` decorators instead of `input()`/`output()` signals?
- [ ] `*ngIf`, `*ngFor` instead of `@if`/`@for`/`@switch`?
- [ ] Constructor injection instead of `inject()`?
- [ ] `BehaviorSubject` for local state instead of `signal()`?
- [ ] Missing `changeDetection: ChangeDetectionStrategy.OnPush`?
- [ ] `any` type anywhere?
- [ ] Arbitrary Tailwind values like `bg-[#...]` instead of design tokens?

### Testing
- [ ] Tests NOT colocated with source files?
- [ ] Implementation written before a failing test?

Report each violation as: `path/to/file.ext:LINE — description`
If no violations, say "No violations found."
