## Context
共用 online-image 后端按参考图分流，失败时可能跨接口回退。
## Goals / Non-Goals
明确两个页面的职责；不改变画布、聊天、细节增强和角度控制的调用契约。
## Decisions
沿用 operation 字段：generate 禁止参考图，edit 要求原图，空值兼容旧调用。generate_ai_image 增加默认空 operation 参数，只对显式操作禁止标准协议跨接口回退。保留特殊协议分支。旧历史仍可查看，文生图复用仅恢复提示词和生成参数，不恢复原图。
## Risks / Trade-offs
上游仅支持 edits 的模型在文生图会报错 → 明确保留错误，不静默转接口；真实上游需用户配置与实际调用，本次 mock 验证不产生出图费用。

## 编辑输出尺寸补充
复用现有尺寸控件，本地模式也启用。仅在 Klein 请求 params 中覆盖 Flux2Scheduler（152）和 EmptyFlux2LatentImage（156）的宽高，参考图编码不变，不改共享工作流文件。
