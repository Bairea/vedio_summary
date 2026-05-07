# Security Policy

## Supported versions

当前项目仍处于本地 MVP 阶段。默认只维护 `main` 分支上的最新版本。

## Reporting a vulnerability

请不要在公开 issue 中粘贴 API keys、cookies、数据库、下载文件或任务产物。若你发现漏洞，请通过私密渠道联系维护者；如果暂时没有公开安全邮箱，请先创建不含敏感细节的 issue，请求维护者提供私密联系方式。

报告建议包含：

- 受影响版本或 commit
- 复现步骤
- 影响范围
- 是否需要 cookies、代理、AI API key 或特定视频链接

## Local secret handling

- API keys 放在环境变量或应用设置中。
- Bilibili / YouTube cookies 只放在本机 `.data/cookies.txt` 或设置页指向的本地文件。
- 不提交 `.data/`、`whisper/`、`.venv/`、下载媒体或日志。
