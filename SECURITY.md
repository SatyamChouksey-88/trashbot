# Security

## Reporting

Open a [GitHub issue](https://github.com/SatyamChouksey-88/trashbot/issues) for vulnerabilities or sensitive data accidentally committed. Do not post secrets in the issue body.

## Secrets

- Never commit `firmware/include/secrets.h`, API keys, Wi‑Fi passwords, or robot tokens.
- Use `firmware/include/secrets.example.h` as a template only.
- CI runs [Gitleaks](https://github.com/gitleaks/gitleaks) on full git history for pushes and pull requests.

## Test data

Simulator, mock robot, and dataset stubs use synthetic or public reference material only — no employer or client production data.
