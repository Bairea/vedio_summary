# Configuration

Most runtime configuration is stored through the app settings page and persisted in `vedio_summary_v1/.data/app.db`.

## AI provider

The app expects an OpenAI-compatible chat/completions endpoint for summary, mindmap, and QA generation.

Common fields:

- Base URL
- Model
- API Key

Do not commit real keys. Use shell environment variables or paste values into the local settings UI.

## Downloads and cookies

`yt-dlp` can be discovered from PATH, configured by absolute path, or installed locally by the app when supported.

For Bilibili videos that require login state:

1. Export cookies from your browser.
2. Save them to `vedio_summary_v1/.data/cookies.txt` or another local ignored path.
3. Point the app settings to that file if you do not use the default path.

## Local Whisper fallback

Optional ASR uses `mlx-whisper` through a local Python runtime. Resolution order:

1. `MLX_WHISPER_PYTHON`
2. repository `.venv/bin/python`
3. system `python3`

Model files are expected under the root `whisper/` directory and are ignored by git.
