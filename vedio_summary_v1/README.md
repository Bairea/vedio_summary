# 视频总结器 MVP

本项目是一个本地运行的 YouTube / Bilibili 视频总结器 MVP，当前已经验证可跑通以下链路：

- 工作台创建单个视频任务
- `yt-dlp` 解析视频信息与下载音频
- 平台字幕优先，本地 `mlx-whisper` 作为 fallback
- 基于字幕生成摘要、Markmap 导图与引用式问答
- 在详情页直接查看摘要 / 导图 / 字幕 / 问答，并导出结果

核心产物：

- 前端工作台与设置页
- 本地 Express API
- 任务数据与配置持久化到 `.data/app.db`
- `yt-dlp` 下载链路
- 本地 `mlx-whisper` 字幕兜底链路
- OpenAI 兼容摘要 / 导图 / 问答链路
- Markmap 导图渲染与 Markdown / SVG 导出

## 环境要求

- Node.js 20+
- npm 10+
- macOS / Linux 优先
- 可选：系统已安装 `yt-dlp`
- 推荐：使用 `uv` 管理本地 Python 虚拟环境

说明：

- 仓库内如果已有 `.data/bin/yt-dlp`，健康检查会优先识别该本地二进制。
- 如果没有可用 `yt-dlp`，可在设置页填写路径，或后续由应用下载到 `.data/bin/yt-dlp`。
- 本地 Whisper 默认使用仓库根目录下的 `whisper/` 作为模型目录。
- 如平台字幕缺失且开启 ASR，系统会自动尝试本地 `mlx-whisper`。
- 应用会优先使用 `MLX_WHISPER_PYTHON`，其次自动识别项目内 `.venv/bin/python`，最后才回退到系统 `python3`。

## 快速开始

### 1. 安装 Node 依赖

```bash
npm install
```

### 2. 用 `uv` 配置本地 Whisper

推荐在项目根目录创建虚拟环境，并让应用自动复用：

```bash
uv venv .venv
uv pip install --python .venv/bin/python mlx-whisper
```

如果你希望显式指定 Python，可设置：

```bash
export MLX_WHISPER_PYTHON="$(pwd)/.venv/bin/python"
```

### 3. 下载 Whisper 模型

Whisper 模型文件会被应用在仓库根目录下的 `whisper/` 中查找。
本项目使用 MLX 格式的量化模型，从 Hugging Face 下载：

```bash
# 安装 huggingface-cli（如果尚未安装）
uv pip install huggingface-hub

# 下载 whisper-large-v3-turbo 的 4-bit 量化版到 whisper/ 目录
huggingface-cli download mlx-community/whisper-large-v3-turbo-q4 --local-dir whisper
```

下载完成后目录结构应为：

```text
whisper/
  config.json
  weights.npz
```

### 4. 启动应用

```bash
npm run dev
```

启动后默认入口：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`
- 健康检查：`http://localhost:3001/api/health`

## AI 配置示例

### DashScope / 通义千问

如果你把 `DASHSCOPE_API_KEY` 放在 `~/.zshrc` 中，可先加载环境变量：

```bash
source ~/.zshrc
```

然后在设置页填：

- `Base URL`: `https://dashscope.aliyuncs.com/compatible-mode`
- `Model`: `qwen-plus`
- `API Key`: 使用 `$DASHSCOPE_API_KEY`

也可以直接在 shell 中导出：

```bash
export DASHSCOPE_API_KEY="your-key"
```

设置页点击“测试 AI”返回成功后，再开始全流程任务。

## 运行步骤

1. 执行 `npm install`
2. 如需本地 ASR，执行 `uv venv .venv` 与 `uv pip install --python .venv/bin/python mlx-whisper`
3. 下载模型：`huggingface-cli download mlx-community/whisper-large-v3-turbo-q4 --local-dir whisper`
4. 执行 `npm run dev`
5. 打开 `http://localhost:5173/settings`
6. 在设置页填写 `Base URL`、`API Key`、`Model`
7. 点击“保存”，确认页面会自动执行一次 AI 测试，并刷新“运行基线检查”
8. 回到工作台，选择“推荐流程”或任一部分流程，粘贴 YouTube / Bilibili 链接后创建任务
9. 在详情页查看摘要、Markmap 导图、字幕导出和问答历史；导图支持导出 Markdown / SVG

## 健康检查说明

`GET /api/health` 返回当前运行基线状态，聚合以下项目：

- 数据目录是否可用
- AI 摘要配置是否完整
- `yt-dlp` 是否可用
- Markmap 依赖是否已安装
- 本地 Whisper 目录与 `config.json` 是否存在
- 固定权重 `whisper/weights.npz` 是否存在
- `cookies.txt` 是否存在

说明：

- 总体状态只把“必需项”计入阻断条件
- `本地 Whisper` 与 `Whisper 权重` 当前只做可见性检查，作为 Task2 的前置观察项，不阻断 Task1 的“就绪”
- `cookies.txt` 为可选项，仅展示状态，不阻断“就绪”
- AI 连通性不在聚合健康检查内，使用设置页“测试 AI”单独验证
- 点击设置页“保存”后，会自动触发一次 AI 连通性测试，并在同一轮操作后刷新健康检查状态
- 设置里的 `outputDir` 已接入任务产物目录，可把任务文件输出到自定义位置

## 验证命令

```bash
npx tsx --test api/services/__tests__/subtitleService.test.ts api/services/__tests__/taskService.test.ts api/services/__tests__/mindmapService.test.ts api/services/__tests__/qaService.test.ts
npm run check
npm run build
```

预期结果：

- 字幕 / 流水线 / 导图 / 问答服务测试通过
- TypeScript 检查通过
- Vite 构建通过

## 真实冒烟路径

已在本机验证过一条真实 Bilibili 全流程任务，链路如下：

1. 设置页填入有效 OpenAI 兼容 AI 配置并通过“测试 AI”
2. 工作台选择“推荐流程”
3. 创建单个 Bilibili 链接任务
4. 任务经过 `parse -> subtitles -> summary -> mindmap -> qaIndex`
5. 在详情页直接完成：
   - 摘要查看、复制、下载
   - Markmap 导图查看、Markdown 导出、SVG 导出
   - `srt / vtt / txt / json` 字幕导出
   - 带 citations 的问答与历史查看

## 当前确认可用

- 设置页可显示并校验 `yt-dlp`、本地 Whisper、固定权重文件、AI 配置状态
- 工作台可创建单个 YouTube / Bilibili 任务，并切换推荐流程或部分流程
- 平台字幕存在时复用平台字幕；平台字幕缺失时自动走本地 `mlx-whisper`
- 摘要输出为 Markdown，导图输出为 Markmap Markdown
- 问答支持 `citations` 与 `insufficientEvidence`

## 已知限制

- 本地 `mlx-whisper` 运行时必须由本机 Python 环境提供；当前仓库不会自动安装 Python 包
- 任务队列仍是单机串行执行，不支持并发工作进程
- `ytdlpPath`、`cookiesPath`、`asrEnabled`、`outputDir` 已在本轮通过真实后端行为完成专项验证；如更换为你自己的工具路径，仍建议再做一次本机冒烟

## 数据目录

运行过程中生成的数据默认位于：

```text
.data/
  app.db
  cookies.txt
  bin/yt-dlp
  tasks/<task-id>/
```
