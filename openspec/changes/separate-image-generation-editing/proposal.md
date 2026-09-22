## Why
文生图和图片编辑都能带参考图，功能重复。用户确认按纯文字生成和原图编辑分工。
## What Changes
- 文生图移除上传、粘贴参考图，恢复文生图命名。
- 两页分别明确 generate/edit 操作；标准 OpenAI 请求不跨接口自动回退。
- 本地工作流和非标准服务协议适配保留，未指定操作的其他调用保持兼容。
## Capabilities
### New Capabilities
- `explicit-image-operation`: 明确文生图和图片编辑操作与路由契约。
### Modified Capabilities
无。
## Impact
online.html、klein.html、导航翻译、main.py 及相关回归检查；不迁移历史数据。

## 后续确认：编辑输出尺寸
图片编辑本地与在线模式均显示输出尺寸，原图作为参考，输出画幅可独立选择。
