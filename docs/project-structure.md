# Project structure

The repository keeps a small root toolchain plus one main application directory.

```text
.
├── docs/                 # Project-level docs for users and contributors
├── .github/              # Community templates and CI workflow
├── pyproject.toml        # Python/uv helper project for ASR tooling
├── uv.lock               # Locked Python helper dependencies
├── whisper/              # Local MLX Whisper model files; ignored
└── vedio_summary_v1/     # Main local video summarizer app
```

## Main app

```text
vedio_summary_v1/
├── api/
│   ├── routes/           # Express route handlers
│   ├── services/         # Business logic and external tool integration
│   ├── repositories/     # SQLite persistence layer
│   ├── lib/              # Shared backend helpers
│   └── scripts/          # Local helper scripts, including Whisper bridge
├── shared/               # Shared TypeScript DTOs
├── src/
│   ├── components/       # Reusable React components
│   ├── hooks/            # React hooks
│   ├── pages/            # Route-level pages
│   ├── stores/           # Zustand stores
│   └── utils/            # API client helpers
└── public/               # Static frontend assets
```

## Runtime data policy

The following paths are local-only and must not be committed:

- `vedio_summary_v1/.data/`
- `vedio_summary_v1/dist/`
- `vedio_summary_v1/node_modules/`
- `.venv/` and `vedio_summary_v1/.venv/`
- `whisper/`
- cookies files, logs, downloaded media, and generated task artifacts
