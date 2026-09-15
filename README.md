# 印谱（YinPu）

微信小程序：把手写印章草稿预览为朱砂钤印效果。支持**朱文（阳刻）**与**白文（阴刻）**。

前端 Taro 4 + React，后端 NestJS，本机 ComfyUI（SD1.5 + ControlNet）图生图，sharp 做颜色收敛。已不依赖扣子平台。

## 功能

1. 选择草稿图  
2. **step1**：去格子线稿 → ComfyUI 生成印章 → 朱砂色后处理  
3. **step2**：宣纸底效果（朱文本地收尾；白文轻量 AI + 色号统一）  
4. 预览 / 保存到相册  

## 技术栈

| 层 | 技术 |
|----|------|
| 小程序 | Taro 4.1.9 · React 18 · TailwindCSS 4 · weapp-tailwindcss |
| 服务端 | NestJS 10 · TypeScript · sharp |
| 生图 | 本机 ComfyUI · SD1.5 · ControlNet Canny |
| 存储 | 本地磁盘 `server/uploads` + `/uploads` 静态服务 |

## 环境要求

- Node.js ≥ 18，pnpm ≥ 9  
- 微信开发者工具  
- ComfyUI（Windows 便携包即可）  
- GPU：建议 ≥ 8GB（如 RTX 4060），跑 SD1.5 + Canny  

## 目录结构

```
├── config/                 # Taro 构建配置
├── src/                    # 小程序源码
│   └── pages/index/        # 印谱主页面
├── server/                 # NestJS API
│   ├── src/transform/      # step1/step2、生图、色偏
│   ├── .env.example        # 环境变量模板
│   ├── uploads/            # 生成图（不入库）
│   └── workflows/          # 可选 ComfyUI workflow 示例
├── ComfyUI_windows_portable/  # 本机 ComfyUI（不入库，自备）
└── project.config.json
```

## 快速开始

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 配置环境变量

**项目根目录** `.env.local`（注入小程序请求域名）：

```env
PROJECT_DOMAIN=http://localhost:3000
```

**`server/.env.local`**（可参考 `server/.env.example`）：

```env
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
UPLOAD_DIR=./uploads
IMAGE_GENERATOR=comfy
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_CHECKPOINT=v1-5-pruned-emaonly.safetensors
COMFYUI_CONTROLNET=control_v11p_sd15_canny.pth
COMFYUI_STEPS=16
COMFYUI_CN_STRENGTH=0.72
COMFYUI_TIMEOUT_MS=600000
```

调试链路可用 `IMAGE_GENERATOR=mock`（透传原图，不调 ComfyUI）。

### 3. 启动 ComfyUI

- 主模型：`models/checkpoints/v1-5-pruned-emaonly.safetensors`  
- ControlNet：`models/controlnet/control_v11p_sd15_canny.pth`  
- 启动后确认 `http://127.0.0.1:8188` 可访问  

### 4. 启动服务与小程序

```powershell
# 终端 1：后端
pnpm --filter server dev

# 终端 2：小程序 watch
pnpm dev:weapp
```

微信开发者工具导入本仓库根目录：

- AppID：使用你的小程序 AppID  
- 本地设置勾选「不校验合法域名…」  
- 编译后选图 → 朱文/白文 → 保存  

### 常用脚本

```powershell
pnpm dev:server      # 后端
pnpm dev:weapp       # 微信小程序
pnpm build:weapp     # 构建到 dist/
pnpm preview:weapp   # 预览二维码
pnpm validate        # lint + tsc
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/transform/step1` | multipart：`file` + `type=baiwen\|zhuwen` |
| POST | `/api/transform/step2` | json：`imageUrl` + `type` |
| GET | `/api/health` | 健康检查 |
| GET | `/uploads/*` | 本地图床 |

## 安全注意

- 勿提交 `.env.local`、`key/`、`server/uploads/`  
- 生产需 HTTPS 域名，并在微信后台配置 request/uploadFile/downloadFile 合法域名  
- 建议收紧 CORS，并限制 step2 的 `imageUrl` 域名白名单  

## 许可

按你的仓库策略自行补充。
