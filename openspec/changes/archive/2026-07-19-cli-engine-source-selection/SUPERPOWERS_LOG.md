| 检查点 | 是否触发 | 决定/行动 | 证据 |
| --- | --- | --- | --- |
| Brainstorming | 是 | 根据现有 API 设置和 `/api/online-image` 路由，采用第三个 CLI 来源与提供商下拉框；不在文生图页管理安装或登录。 | `proposal.md`、`design.md`、`spec.md` |
| TDD | 是 | 先添加 CLI 来源、请求路由、历史类型和提供商刷新契约；新增刷新断言先失败，再添加事件处理。 | `node --test tests\\zimage-cli-engine.test.mjs` 的红灯与后续绿灯 |
| Debugging | 是 | 浏览器中下拉选项未渲染，定位到页面缺少 `escapeHtml`，补齐安全转义函数。 | `static/zimage.html` 的 `escapeHtml` 与最终浏览器可见的即梦 CLI / GPT CLI 选项 |
| Code review | 是 | 对照所有 spec 场景检查筛选、无配置阻断、请求字段、历史类型和配置变更刷新；未发现范围外改动。 | 代码差异审查、`git diff --check` |
| Verification | 是 | 已配置提供商时实际页面显示 CLI、即梦 CLI 和 GPT CLI；未执行生成，以避免外部额度消耗。无配置分支由 focused contract test 覆盖。 | 浏览器页面检查；Node 测试、Python 编译与 OpenSpec 严格验证 |
