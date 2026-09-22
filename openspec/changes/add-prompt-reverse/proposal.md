## Why
图片反推目前藏在本地素材管理中，无法作为常用创作工具直接使用。用户需要独立入口并按创作顺序整理导航。
## What Changes
- 新增提示词反推页面：上传或拖入图片、选择已配置的对话模型、输出可编辑提示词。
- 结果可复制、发送到文生图或图片编辑、保存到指定提示词库。
- 导航排序为文生图、图片编辑、提示词反推、细节增强、角度控制。
## Capabilities
### New Capabilities
- `prompt-reverse`: 独立图片提示词反推和结果复用。
### Modified Capabilities
无。
## Impact
main.py 复用 caption_image_with_provider；新增页面与脚本；index 导航及结果转交；复用已有上传和词库接口，无新依赖。
