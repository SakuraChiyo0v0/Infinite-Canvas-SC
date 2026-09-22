## Context
提示词使用 positive、negative、scene 字段存储，复用时部分入口只取 positive。
## Goals / Non-Goals
整段输入且不丢旧内容；不自动解析正负文本，不将备注发送模型。
## Decisions
显示时拼接旧 negative 为独立标题段；保存编辑时正文写入 positive 并清空 negative，防止重复。未编辑条目保持原数据。scene 保留为可选备注。画布预览和编辑沿用同一正文转换。
## Risks / Trade-offs
旧负向重复 → 验证保存再打开的幂等性；旧内置覆盖也清空已合并 negative。

## 提示词库宽度修复
按用户要求保持左右三栏，目录约 20%、列表约 25%、编辑区占剩余宽度。清除中间列 640px 最小宽度，工具栏内部换行，窄屏仍保留三列。仅作用于提示词库。
