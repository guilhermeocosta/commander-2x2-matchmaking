# Security policy

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability). You'll get a reply within a few days.

## What's in place

- Secret scanning with gitleaks on every push, PR and weekly.
- Dependency checks with `pnpm audit` and osv-scanner (known vulnerabilities and known malicious packages) on every push, PR and weekly.
- pnpm supply-chain settings in `pnpm-workspace.yaml`: install scripts blocked unless allowlisted, a 3-day minimum release age, trust-downgrade protection, and no git/tarball sub-dependencies.
- GitHub Actions pinned to commit SHAs with read-only default permissions.
