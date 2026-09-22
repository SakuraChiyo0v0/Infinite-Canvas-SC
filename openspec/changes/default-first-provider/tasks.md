## 1. 实施验证
- [x] 1.1 将自动打开推荐 API 限制为没有可见平台时。
- [x] 1.2 完成脚本语法、现有相关检查及默认页面验证。

验证结果：`node --check static/js/api-settings.js` 通过；`api-settings-cli-layout`、`provider-readiness` 两项现有检查通过；OpenSpec 严格校验通过。本地 3000 页面实测初次进入展示 AI Gateway，手动点击推荐 API 可打开，刷新后恢复首个平台配置。
