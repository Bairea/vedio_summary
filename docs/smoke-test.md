# Smoke test: Bilibili video pipeline

This document records the user-provided acceptance URL and the expected local smoke-test path.

## Test URL

```text
https://www.bilibili.com/video/BV196oZB8E4e/?spm_id_from=333.337.search-card.all.click&vd_source=4b1e7ee91746c43e976596a40a3d3e6f
```

## Automated coverage

`api/services/__tests__/ytdlpService.test.ts` includes this exact URL and verifies that Bilibili requests receive browser-like `yt-dlp` safeguards:

- user agent
- `Referer:https://www.bilibili.com`
- `Origin:https://www.bilibili.com`
- `Accept-Language:zh-CN,zh;q=0.9,en;q=0.8`
- bounded sleep interval
- single-fragment concurrency

The automated test is deterministic and does not access the network.

## Manual smoke path

1. Start the app:
   ```bash
   cd vedio_summary_v1
   npm run dev
   ```
2. Open <http://localhost:5173/settings>.
3. Configure AI provider, model, and API key.
4. Optional for protected Bilibili content: set cookies path to a local ignored cookies file.
5. Return to the workbench and paste the URL above.
6. Start the recommended pipeline.
7. Expected stages: `parse -> subtitles -> summary -> mindmap -> qaIndex`.
8. Verify the detail page can show subtitles, summary, mindmap, and QA.

## Troubleshooting

- HTTP 412 or precondition failures usually mean Bilibili risk controls rejected the request. Refresh cookies, use a proxy if needed, and retry later.
- Missing subtitles may fall back to local ASR if enabled and `mlx-whisper` is configured.
- AI failures usually indicate missing API key, incompatible Base URL, or unsupported model.
