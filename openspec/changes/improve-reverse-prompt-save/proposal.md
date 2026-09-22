## Why

反推页保存入口隐藏，默认文件名不易辨认，无法选择分组，成功反馈远离操作区。用户希望保存提示词更顺手。

## What Changes

- 展开紧凑保存区，建议可编辑的内容名称。
- 支持库和分组选择，记住上次成功保存的位置。
- 就地反馈进度、成功和失败，阻止同一内容重复保存。
- 桌面端保持单屏操作，适配展开侧栏，图片和正文高度随窗口调整，正文内部滚动。

## Capabilities

### New Capabilities
- `reverse-prompt-save`: 反推结果便捷保存与目标位置记忆。

### Modified Capabilities
无。

## Impact

仅反推页 HTML、CSS、JavaScript 与相关测试；复用现有提示词库接口，不改变模型调用和库数据格式。
