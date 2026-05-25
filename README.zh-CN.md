# ws-control-platform（中文说明）

[English README](./README.md)

基于 React + Vite + Node WebSocket 网关的远程控制平台。

## 项目结构

- `apps/web`：React + Vite Web 前端
- `apps/mobile`：React Native 骨架（后续扩展）
- `services/gateway`：鉴权/API/WS 网关
- `packages/core`：共享协议/类型/键盘映射
- `packages/ui-tokens`：共享 UI 设计令牌

## 环境要求

- Node.js 20+
- pnpm 9+

## 1）安装依赖

```bash
pnpm install
```

## 2）环境变量文件

项目根目录已提供模板：

- `.env.example`（通用模板）
- `.env.development`（本地开发默认值）
- `.env.production.example`（生产模板）

生产环境建议复制后修改：

```bash
cp .env.production.example .env.production
```

生产模式启动网关：

```bash
pnpm --dir services/gateway start:prod
```

## 3）启动项目（开发模式）

在项目根目录开两个终端：

### 终端 A：启动网关

```bash
pnpm --dir services/gateway dev
```

> 该命令会通过 `tsx --env-file` 自动加载根目录 `.env.development`。

默认监听：`http://127.0.0.1:13701`

### 终端 B：启动前端

```bash
pnpm --dir apps/web dev --host 127.0.0.1 --port 4173
```

浏览器访问：

- Web 页面：`http://127.0.0.1:4173`

## 4）可运行性验证

```bash
pnpm -r typecheck
pnpm -r test
pnpm --dir apps/web test:e2e
```


## 5) docker部署

一键命令:

```bash
# 构建 + 本地部署（默认，不推送远程）
./scripts/docker-deploy.sh all

# 或仅本地部署（跳过推送）
SKIP_PUSH=1 ./scripts/docker-deploy.sh all
```

完整发布到镜像仓库

```bash
# 先登录仓库
docker login ghcr.io   # 或 docker.io

# 构建 + 部署 + 推送
DOCKER_REGISTRY=ghcr.io/你的用户名 \
DOCKER_TAG=v1.0.0 \
./scripts/docker-deploy.sh all
```

## NAS + FRP 生产配置建议

网关进程至少应配置：

```bash
JWT_SECRET=<高强度随机密钥>
AUTH_USERNAME=<登录用户名>
AUTH_PASSWORD=<登录密码>
COOKIE_SECURE=true
PORT=33721
NODE_ENV=production
```

## 当前安全基线

网关已包含：

- JWT + HttpOnly Cookie 鉴权
- 对 `/api/device/*` 的 CSRF 校验（变更接口）
- Zod 请求参数校验
- 登录与 API 限流
- 设备配置按用户隔离存储

## 设备配置规则

- 设备唯一键：`serial + transportId`
- 首次连接：必须传配置并保存
- 后续连接：自动复用已保存配置
- 修改配置：永久更新（不支持临时覆盖）

## 测试命令

```bash
pnpm --filter @wsctl/core test
pnpm --filter @wsctl/gateway test
pnpm --filter @wsctl/web test
pnpm --filter @wsctl/web typecheck
pnpm --dir apps/web test:e2e
```
