# 下载 ControlNet Canny（SD1.5）模型说明

## 1. 放到哪里

把下载的 `.pth` 放到：

```
E:\Users\Admin\github\ComfyUI_windows_portable\ComfyUI\models\controlnet\
```

文件名必须是（或与 .env.local 里 `COMFYUI_CONTROLNET` 一致）：

```
control_v11p_sd15_canny.pth
```

## 2. 推荐下载源（任选其一）

### Hugging Face（官方 lllyasviel 仓库）

```
https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth
```

约 1.4GB。

### 镜像（国内网络更稳）

```
https://hf-mirror.com/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth
```

PowerShell 下载示例：

```powershell
cd E:\Users\Admin\github\ComfyUI_windows_portable\ComfyUI\models\controlnet
curl.exe -L -o control_v11p_sd15_canny.pth `
  "https://hf-mirror.com/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth"
```

## 3. 下载后

1. 确认文件完整（约 1.4GB，不要是 HTML 错误页）
2. **重启 ComfyUI**
3. 重启 Nest：`pnpm --filter server dev`
4. `.env.local` 已配置 `COMFYUI_CONTROLNET=control_v11p_sd15_canny.pth`

## 4. 可选微调

```env
COMFYUI_CN_STRENGTH=0.85   # 0.7~1.0，越高越贴线稿
COMFYUI_CANNY_LOW=0.3
COMFYUI_CANNY_HIGH=0.7
COMFYUI_STEPS=16
```
