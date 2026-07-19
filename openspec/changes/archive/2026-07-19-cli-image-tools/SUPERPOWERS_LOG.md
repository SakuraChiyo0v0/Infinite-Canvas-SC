## Superpowers 过程记录

| 检查点 | 是否触发 | 决定/行动 | 证据 |
| --- | --- | --- | --- |
| Brainstorming | 是 | 确认三个本地图片工具复用现有的 `/api/online-image` 路由；CLI 请求以 data URL 上传源图/参考图，不新增后端接口。 | proposal、design 与 `cli-image-tool-editing` spec |
| TDD | 是 | 先新增三页 CLI 合同测试；实现前缺少公共提供商发现与工具路由，测试按预期失败；随后补齐实现并转绿。 | `tests/cli-image-tools.test.mjs` |
| Debugging | 否 | 没有遇到不符合规格的产品故障；脚本语法检查排除了 `type="module"` 的 Three.js 模块，属于测试边界修正。 | `tests/local-image-tool-scripts.test.mjs` |
| Code review | 是 | 对照规格检查三页均限制为已启用、具有图像模型的 CLI 提供商；确认提交均带参考图、所选提供商/模型和各自历史类型，原有本地/云端分支保留。 | 静态审查与合同测试 |
| Verification | 是 | 浏览器中验证细节增强页可切换 CLI，且读取到已配置的即梦 CLI 与 GPT CLI；未提交真实生成以避免外部 CLI 调用或计费。其余两页由同一共享选择器和跨页合同覆盖。 | 浏览器冒烟、Node 测试与 OpenSpec 严格校验 |
