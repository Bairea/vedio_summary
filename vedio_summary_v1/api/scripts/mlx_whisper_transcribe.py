import json
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: mlx_whisper_transcribe.py <audio_path> <model_dir> [language]", file=sys.stderr)
        return 2

    audio_path = sys.argv[1]
    model_dir = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None

    try:
        import mlx_whisper
    except Exception as exc:  # pragma: no cover
        print(
            f"无法导入 mlx_whisper，请先执行 `pip install mlx-whisper`：{exc}",
            file=sys.stderr,
        )
        return 1

    try:
        result = mlx_whisper.transcribe(
            audio_path,
            path_or_hf_repo=model_dir,
            language=language,
        )
    except Exception as exc:  # pragma: no cover
        print(f"mlx-whisper 转写失败：{exc}", file=sys.stderr)
        return 1

    payload = {
        "text": result.get("text", ""),
        "segments": [
            {
                "start": item.get("start", 0),
                "end": item.get("end", 0),
                "text": item.get("text", ""),
            }
            for item in (result.get("segments") or [])
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
