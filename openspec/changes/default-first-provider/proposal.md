## Why
API 设置加载后已选中平台列表第一项，却又强制切换到推荐 API，导致默认展示与列表选中状态不一致。

## What Changes
- 有可见平台时，进入页面默认展示列表第一项的配置。
- 没有可见平台时保留推荐页；保留手动进入推荐页的入口。

## Capabilities
### New Capabilities
- `default-first-provider`: API 设置默认展示首个平台。

### Modified Capabilities
无。

## Impact
仅调整 API 设置前端的初始页面选择，不修改平台数据、排序、接口或密钥。
