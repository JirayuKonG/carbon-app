# Contributing Guide

This file explains how to keep project changes and documentation consistent.

## Before You Change Code

- Read [README.md](README.md) for the project overview.
- Use [GUIDE.md](GUIDE.md) for setup and run commands.
- Use [COMPONENT_PJ.md](COMPONENT_PJ.md) to find the right frontend or backend file.
- Check [BUG_LOG.md](BUG_LOG.md) to avoid duplicating known issues.

## Documentation Rules

- Update `README.md` for overview-level changes.
- Update `GUIDE.md` for setup, build, database, or environment changes.
- Update `COMPONENT_PJ.md` when routes, pages, shared components, or module locations change.
- Update `BUG_LOG.md` when you confirm, fix, or re-test a bug.
- Update `SECURITY.md` when security contacts, reporting process, or sensitive-data handling rules change.

## Change Workflow

1. Make the code change.
2. Verify the affected app or workspace command still works.
3. Update the matching `.md` file if behavior, setup, or structure changed.
4. Keep examples and commands aligned with the real `package.json` scripts.

## Good Documentation Habits

- Prefer short sections with one purpose each.
- Keep command examples copy-paste friendly.
- Use the actual repo paths from this project.
- Record dates when the information depends on a specific verification run.

## Recommended Future Docs

If the project keeps growing, these files would be good additions:

- `CHANGELOG.md` for release history
- `API.md` for endpoint conventions and request examples
- `DEPLOYMENT.md` for production setup
- `TESTING.md` for verification and regression workflows
