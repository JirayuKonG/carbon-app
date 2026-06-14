# Contributing Guide

Last updated: 2026-06-11

This file explains how to keep project changes and documentation consistent.

## Before You Change Code

- Read [README.md](README.md) for the project overview.
- Use [GUIDE.md](GUIDE.md) for setup and run commands.
- Use [COMPONENT_PJ.md](COMPONENT_PJ.md) to find the right frontend or backend file.
- Check [BUG_LOG.md](BUG_LOG.md) to avoid duplicating known issues.
- Read [CONTEXT.md](CONTEXT.md) before large feature or workflow changes.

## Documentation Rules

- Update `README.md` for overview-level changes.
- Update `GUIDE.md` for setup, build, database, or environment changes.
- Update `COMPONENT_PJ.md` when routes, pages, shared components, or module locations change.
- Update `BUG_LOG.md` when you confirm, fix, or re-test a bug.
- Update `CONTEXT.md` when behavior, routing, data flow, or source-of-truth guidance changes.
- Update `SECURITY.md` when security contacts, reporting process, or sensitive-data handling rules change.

## Working Notes Vs Core Docs

Keep the long-form internal notes focused:

- `summary_kongWork.md`: responsibility and overall delivery summary
- `DASHBOARD_WORK_SUMMARY.md`: dashboard/report work history
- `CONCLUSION_CARBON_CAL_TABLE.md`: calculation-design notes and extracted domain rules

Do not move setup or route source-of-truth information into those files when it belongs in `README.md`, `GUIDE.md`, `COMPONENT_PJ.md`, or `CONTEXT.md`.

## Change Workflow

1. Make the code change.
2. Verify the affected app or workspace command still works.
3. Update the matching `.md` file if behavior, setup, routes, or structure changed.
4. Keep examples and commands aligned with the real `package.json` scripts and actual repo files.
5. If the database snapshot or Prisma source of truth changes, update `README.md`, `GUIDE.md`, and `CONTEXT.md` together.

## Good Documentation Habits

- Prefer short sections with one purpose each.
- Keep command examples copy-paste friendly.
- Use the actual repo paths from this project.
- Record dates when the information depends on a specific verification run.
- Separate current source-of-truth notes from historical implementation notes.

## Recommended Future Docs

If the project keeps growing, these files would be good additions:

- `CHANGELOG.md` for release history
- `API.md` for endpoint conventions and request examples
- `DEPLOYMENT.md` for production setup
