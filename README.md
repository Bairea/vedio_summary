# Video Summary Local

本仓库是一个本地优先的视频总结器：输入 YouTube 或 Bilibili 链接，应用会尝试获取字幕，必要时用本地 `mlx-whisper` 转写，并生成摘要、Markmap 导图与带引用的问答结果。

> 主应用位于 [`vedio_summary_v1/`](vedio_summary_v1/)。目录名保留现状以避免破坏已有脚本和本地数据路径。

## 功能概览

- React + Vite 工作台，用于创建、查看和重试视频处理任务
- Express API 与本地 SQLite 持久化
- `yt-dlp` 视频信息解析、字幕下载与音频下载
- Bilibili 请求保护参数与 cookies/proxy 配置支持
- 平台字幕优先，本地 `mlx-whisper` 作为 ASR fallback
- OpenAI 兼容接口生成摘要、导图和问答索引
- Markdown / SVG / SRT / VTT / TXT / JSON 导出

## 仓库结构

```text
.
├── README.md                  # 仓库入口与快速开始
├── LICENSE                    # 开源许可证
├── CONTRIBUTING.md            # 贡献指南
├── SECURITY.md                # 安全与漏洞报告
├── CODE_OF_CONDUCT.md         # 社区行为准则
├── docs/                      # 面向使用者和贡献者的项目文档
├── .github/                   # Issue / PR 模板与 CI
├── pyproject.toml             # 本地 ASR/工具链辅助 Python 项目
├── uv.lock                    # Python 工具链锁文件
├── whisper/                   # 本地模型目录（被 git 忽略）
└── vedio_summary_v1/          # 主应用：React 前端 + Express API
```

更多层级说明见 [`docs/project-structure.md`](docs/project-structure.md)。

## 快速开始

```bash
cd vedio_summary_v1
npm install
npm run dev
```

默认地址：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>
- 健康检查：<http://localhost:3001/api/health>

完整安装、AI 配置、Whisper 模型和 cookies 说明见 [`vedio_summary_v1/README.md`](vedio_summary_v1/README.md) 与 [`docs/configuration.md`](docs/configuration.md)。

## 验证

从 `vedio_summary_v1/` 执行：

```bash
npm test
npm run check
npm run build
```

可选：

```bash
npm run lint
```

## Bilibili 冒烟测试用例

用户验收用例记录在 [`docs/smoke-test.md`](docs/smoke-test.md)：

```text
https://www.bilibili.com/video/BV196oZB8E4e/?spm_id_from=333.337.search-card.all.click&vd_source=4b1e7ee91746c43e976596a40a3d3e6f
```

自动化测试不会访问外网；它验证该 Bilibili URL 会启用 `yt-dlp` 的浏览器 UA、Referer、Origin、Accept-Language、降频和单分片请求保护参数。

## 贡献

欢迎先阅读：

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`docs/development.md`](docs/development.md)
- [`SECURITY.md`](SECURITY.md)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)

## 安全与隐私

不要提交 API Key、cookies、`.data/app.db`、下载内容、模型权重或本地虚拟环境。示例配置只保留在 `.env.example`，真实配置请放在本机环境变量、应用设置页或被忽略的本地文件中。

## License

MIT License. See [`LICENSE`](LICENSE).
