## Context
静态页面已共享 theme.css，但 select 仍使用原生弹出菜单。现有代码通过 value/change 和动态 option 管理业务。
## Goals / Non-Goals
统一单选控件外观，保留业务、键盘、禁用和动态选项。不替换多选列表、不改变布局或 API。
## Decisions
通过 @supports 启用 appearance: base-select 和 ::picker(select)，沿用现有 --ui-* 变量。旧浏览器回退标准 select，避免引入 JavaScript 模拟组件。
## Risks / Trade-offs
旧浏览器菜单无法完全定制；当前内置浏览器进行展开、关闭与选择验证。弹层仍受 iframe 边界约束，菜单限制可视高度并滚动。
实施补充：更新各 HTML 对共享主题文件的版本参数，避免浏览器继续使用旧缓存。浏览器已验证菜单展开、点击选择 2K、恢复 1K、Escape 关闭以及深浅主题显示。
