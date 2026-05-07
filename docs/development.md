# Development guide

## Prerequisites

- Node.js 20+
- npm 10+
- Optional: `uv` for Python virtualenv management
- Optional: `yt-dlp` available on PATH or configured in the app settings
- Optional: local MLX Whisper model under `whisper/`

## Install

```bash
cd vedio_summary_v1
npm install
```

Optional ASR setup from repository root:

```bash
uv venv .venv
uv pip install --python .venv/bin/python mlx-whisper
```

## Run locally

```bash
cd vedio_summary_v1
npm run dev
```

This starts Vite and the Express API together.

## Useful commands

```bash
npm run client:dev   # frontend only
npm run server:dev   # API only
npm test             # backend unit tests via tsx + Node test runner
npm run check        # TypeScript check
npm run lint         # ESLint
npm run build        # TypeScript build + Vite production build
```

## Testing expectations

- Add focused backend tests under nearby `__tests__/` folders.
- Prefer deterministic tests over real network calls.
- Use the Bilibili URL in `docs/smoke-test.md` as a manual smoke target and as non-network fixture input for unit tests.
- For changes touching `yt-dlp`, cookies, ASR, summaries, mindmaps, or task storage, run targeted tests first, then the full command set.
