## Context
后端已有配置不注入缺失的默认平台。前端 isFixedProvider 和 sortedProviders 限制了排序。
## Goals / Non-Goals
统一拖动删除能力；不扩大为删除供应商适配代码。
## Decisions
解除前端固定规则，列表沿用持久化顺序。对配置仅过滤两个指定 ID，先保存可恢复快照。
## Risks / Trade-offs
旧页面可写回旧配置 → 提醒刷新，验证 API 列表。
