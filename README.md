# Video Summary Local

本仓库是一个本地优先的视频总结器：输入 YouTube 或 Bilibili 链接，应用会尝试获取字幕，必要时用本地 `mlx-whisper` 转写，并生成摘要、Markmap 导图与带引用的问答结果。

> 主应用位于 [`vedio_summary_v1/`](vedio_summary_v1/)。目录名保留现状以避免破坏已有脚本和本地数据路径。

## 这是一个什么项目

- 本地优先的视频总结器
- 支持 YouTube / Bilibili 链接
- 可生成字幕、摘要、Markmap 导图和带引用的问答结果
- 前端是 React + Vite，后端是 Express + SQLite

## 仓库里最重要的文件

- `vedio_summary_v1/README.md`：主应用的完整安装、配置和运行说明
- `LICENSE`：开源许可证
- `CONTRIBUTING.md`：贡献规范
- `SECURITY.md`：安全披露与本地秘密处理
- `CODE_OF_CONDUCT.md`：社区行为准则
- `.github/`：Issue / PR 模板与 CI
- `.env.example`：根目录环境变量示例

## 快速开始

```bash
cd vedio_summary_v1
npm install
npm run dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

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

## Bilibili 验收用例

```text
https://www.bilibili.com/video/BV196oZB8E4e/?spm_id_from=333.337.search-card.all.click&vd_source=4b1e7ee91746c43e976596a40a3d3e6f
```

该 URL 已被自动化测试覆盖为纯参数校验，不依赖网络。它验证 B 站请求会带上浏览器 UA、Referer、Origin、Accept-Language、降频和单分片请求保护参数。

## 贡献与安全

开始前先看：

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`SECURITY.md`](SECURITY.md)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`vedio_summary_v1/README.md`](vedio_summary_v1/README.md)

不要提交 API Key、cookies、`.data/app.db`、下载内容、模型权重或本地虚拟环境。真实配置请放在本机环境变量、应用设置页或被忽略的本地文件中。

## License

MIT License. See [`LICENSE`](LICENSE).
