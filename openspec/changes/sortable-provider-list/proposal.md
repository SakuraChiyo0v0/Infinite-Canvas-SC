## Why
固定平台不能排序且占据列表，用户希望全部可拖动并移除不用的 RunningHub 和火山引擎。
## What Changes
- 取消固定置顶及拖动删除限制。
- 当前本地配置移除两个指定平台，保留其他配置及顺序。
## Capabilities
### New Capabilities
- `sortable-provider-list`: 所有平台按保存顺序显示且可拖动。
### Modified Capabilities
无。
## Impact
API 设置前端、当前平台配置；不删除协议实现、历史图片或密钥。
