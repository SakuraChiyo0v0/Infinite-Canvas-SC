## Why
用户习惯粘贴包含正负约束的整段提示词，拆分输入不便。
## What Changes
- 合并正文输入，用途说明改为折叠的可选备注。
- 兼容旧正负字段，复制和画布应用使用完整正文。
## Capabilities
### New Capabilities
- `unified-prompt-content`: 单一正文编辑与旧负向内容兼容。
### Modified Capabilities
无。
## Impact
素材管理与两种画布前端，不批量迁移数据或更改生成接口。
