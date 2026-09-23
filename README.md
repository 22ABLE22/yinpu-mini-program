# 印谱（YinPu）

微信小程序：把手写印章草稿预览为朱砂钤印效果。支持**朱文（阳刻）**与**白文（阴刻）**。

前端 Taro 4 + React，后端 NestJS，本机 ComfyUI（SD1.5 + ControlNet）图生图，sharp 做颜色收敛。已不依赖扣子平台。

## 架构（一图看懂）

```
微信小程序 pages/index
    │  PROJECT_DOMAIN → uploadFile / request
    ▼
NestJS  /api/transform/step1|step2
    ├── toControlNetLineArt     去红格、留墨迹
    ├── ImageGenerator          comfy | mock
    │     └── ComfyUI 8188      SD1.5 + Canny
    ├── ColorProcessor          朱文/白文色收敛、纸纹
    └── StorageService          server/uploads → /uploads
```

服务端职责拆分：

| 模块 | 职责 |
|------|------|
| `transform.controller.ts` | HTTP 入参、imageUrl 域名白名单 |
| `transform.service.ts` | step1/step2 流程编排 |
| `seal-prompts.ts` | 生图提示词 |
| `seal.constants.ts` | 朱砂/宣纸色 |
| `image-math.ts` | 纸纹噪声、色偏判定 |
| `color.processor.ts` | sharp 像素处理 |
| `comfyui.generator.ts` | ComfyUI API 客户端 |
| `mock.generator.ts` | 链路调试用 |
| `storage.service.ts` | 本地磁盘图床 |

前端：`pages/index` + `network.ts`（域名拼接、长超时）+ `components/ui` 组件库（按需引用）。

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

### 路径说明（本机参考）

| 用途 | 路径 |
|------|------|
| 项目根目录 | `E:\Users\Admin\github\Proofreading-preview` |
| ComfyUI | `E:\Users\Admin\github\ComfyUI_windows_portable` |
| 环境变量 | 项目根 `.env.local`、`server\.env.local` |

下面所有命令都在**项目根目录**执行（先把终端 `cd` 过去）。

---

## 重启电脑后如何继续（日常开发）

电脑重启后，**三项服务不会自动启动**，必须按顺序手动拉起来。

### 第 0 步：打开项目

```powershell
cd E:\Users\Admin\github\Proofreading-preview
```

### 第 1 步：启动 ComfyUI（生图）

另开一个 PowerShell：

```powershell
cd E:\Users\Admin\github\ComfyUI_windows_portable
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build
```

（也可双击目录里对应的 `run_*.bat` / 启动脚本。）

**是否成功：** 浏览器打开 `http://127.0.0.1:8188` 能看到 ComfyUI 界面。

> 8G 显存若不稳，可加：`--lowvram`。

### 第 2 步：启动后端 Nest（API）

**新开**一个 PowerShell：

```powershell
cd E:\Users\Admin\github\Proofreading-preview
pnpm --filter server dev
```

**是否成功：** 终端出现类似：

```text
Server running on http://localhost:3000
Static uploads: http://localhost:3000/uploads/ → ...
```

自测：

```powershell
curl.exe http://localhost:3000/api/health
```

应返回 JSON（如 `{"status":"success",...}`）。

> 若端口占用：先结束占用 3000 的进程，或改 `server/.env.local` 里的 `PORT`。

### 第 3 步：启动小程序构建（watch）

**再新开**一个 PowerShell：

```powershell
cd E:\Users\Admin\github\Proofreading-preview
pnpm dev:weapp
```

**是否成功：** 出现类似 `built in xxxxms`，且日志里有：

```text
[config] PROJECT_DOMAIN=http://localhost:3000
```

若显示 `PROJECT_DOMAIN is empty`，检查项目根 `.env.local` 后**完全停掉再重启** `pnpm dev:weapp`。

### 第 4 步：微信开发者工具

1. 打开微信开发者工具  
2. 导入项目目录：`E:\Users\Admin\github\Proofreading-preview`  
3. AppID：你的小程序 AppID（如 `wx5cc481107b22f822`）  
4. **详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」**  
5. 点「编译」→ 选图 → 朱文/白文 → 保存  

### 第 5 步：真机预览（可选）

1. 开发者工具「预览」扫码  
2. 手机微信：右上角 **… → 开发调试 → 打开调试**  
3. 项目根与 `server/.env.local` 中域名需为**电脑局域网 IP**（不能是 `localhost`）：

```env
# 查看本机 IP
ipconfig
# 例如以太网是 192.168.1.112，则：
PROJECT_DOMAIN=http://192.168.1.112:3000
PUBLIC_BASE_URL=http://192.168.1.112:3000
```

4. 改完域名后：**重启 Nest** + **重启 `pnpm dev:weapp`**，再预览  
5. 手机与电脑同一 Wi-Fi；防火墙放行 TCP 3000  

手机浏览器可先测：`http://192.168.1.112:3000/api/health`。

---

### 重启后检查清单（打印用）

| 顺序 | 事项 | 验证 |
|------|------|------|
| 1 | ComfyUI 已启动 | 打开 `http://127.0.0.1:8188` |
| 2 | Nest 已启动 | `curl.exe http://localhost:3000/api/health` 有 JSON |
| 3 | weapp watch 已启动 | 编译成功，日志含 `PROJECT_DOMAIN=` |
| 4 | 开发者工具已打开本项目 | 勾选不校验域名 |
| 5 | （真机）域名=局域网 IP | 手机能访问 `/api/health` |

三个终端（ComfyUI / Nest / weapp）建议保持不要关。

---

## 首次安装（换电脑或删了依赖时）

### 1. 安装依赖

```powershell
cd E:\Users\Admin\github\Proofreading-preview
pnpm install
```

### 2. 配置环境变量

复制并按需修改：

- 项目根：`.env.local`（必须有 `PROJECT_DOMAIN`）  
- 服务端：`server/.env.local`（参考 `server/.env.example`）  

电脑开发默认：

```env
# 项目根 .env.local
PROJECT_DOMAIN=http://localhost:3000
```

```env
# server/.env.local
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

仅测链路、不调生图：`IMAGE_GENERATOR=mock`。

### 3. 确认 ComfyUI 模型文件存在

| 文件 | 目录 |
|------|------|
| `v1-5-pruned-emaonly.safetensors` | `ComfyUI...\models\checkpoints\` |
| `control_v11p_sd15_canny.pth` | `ComfyUI...\models\controlnet\` |

### 4. 按上文「重启电脑后如何继续」启动三个服务

### 常用脚本

```powershell
pnpm --filter server dev   # 后端
pnpm dev:weapp             # 微信小程序 watch
pnpm build:weapp           # 构建到 dist/
pnpm preview:weapp         # 预览二维码
pnpm validate              # lint + tsc
```

### Git 推送（版本管理）

```powershell
cd E:\Users\Admin\github\Proofreading-preview
git status
git add -A
git commit -m "描述本次修改"
# 使用你自己的凭证推送，勿把 PAT 写进仓库文件
git push origin main
```

首次配置作者：

```powershell
git config user.name "你的GitHub用户名"
git config user.email "你的GitHub noreply邮箱"
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
