# Contributing

Thanks for looking. This is a free, open tool for students — contributions of
any size are welcome, including typo fixes and translations.

## Getting set up

```bash
git clone https://github.com/mateeniqbal3/student-toolkit.git
cd student-toolkit
npm install
npm run dev
```

You do not need any API keys to work on tools 1–8; they run entirely in the
browser. Only the AI assistant needs a key, and it supports bring-your-own-key,
so you can develop against your own free Gemini key without touching `.env`.

## Before you open a pull request

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
```

CI runs exactly these, plus a Playwright smoke test, and must pass before merge.
A pre-commit hook runs ESLint and Prettier on staged files, so formatting should
take care of itself.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org):
  `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`.
- **Branches** are named `phase-N-topic` or `feat/topic`.
- **Pull requests** are squash-merged into `main`.
- **No new runtime dependency** without a note in `DECISIONS.md` explaining why
  the bundle cost is worth it. The performance budget is real: students on slow
  3G are the target audience.
- **No server calls from tools 1–8.** This is the architectural constraint the
  whole project rests on. See `ARCHITECTURE.md`.

## Reporting a bug

Open an issue with the tool name, what you expected, what happened, and your
browser and device. If it involves your own data (notes, grades), please do not
paste it — we cannot see it anyway, and a description is enough.
