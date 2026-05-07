# Contributing

感谢你考虑贡献本项目。这个仓库优先保证本地可运行、可验证、不会泄露用户凭证或生成数据。

## 开发流程

1. Fork / 创建分支。
2. 从主应用目录安装依赖：
   ```bash
   cd vedio_summary_v1
   npm install
   ```
3. 修改前先查看相关测试；后端测试位于 `api/**/__tests__/`。
4. 提交前运行：
   ```bash
   npm test
   npm run check
   npm run build
   ```
5. 若改动涉及样式、路由或交互，请附截图或录屏。

## 代码风格

- 新的前端和 API 模块优先使用 TypeScript。
- React 组件使用 `PascalCase`，hooks 使用 `use` 前缀。
- 服务命名为 `camelCaseService.ts`，仓储命名为 `camelCaseRepo.ts`。
- 不提交生成数据、下载媒体、模型权重、数据库、cookies 或 API keys。

## Pull Request 要求

PR 描述请包含：

- 行为变化摘要
- 运行过的验证命令和结果
- 任何新环境变量、cookies、API key 或外部二进制需求
- 可见 UI 改动的截图或录屏

## Commit 信息

建议使用 Conventional Commits，例如：

```text
feat(api): add bilibili smoke safeguard coverage
```

如果遵循本仓库的 Lore commit 协议，请在提交正文中记录约束、测试和未覆盖项。
