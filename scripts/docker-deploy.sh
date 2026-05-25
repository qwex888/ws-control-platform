#!/usr/bin/env bash
# ws-control-platform Docker 一键构建 / 部署 / 发布
#
# 用法:
#   ./scripts/docker-deploy.sh all              # 构建 + 本地部署 + 推送镜像
#   ./scripts/docker-deploy.sh build            # 仅构建镜像
#   ./scripts/docker-deploy.sh deploy           # 仅本地部署（docker compose up）
#   ./scripts/docker-deploy.sh publish          # 仅推送镜像到仓库
#   ./scripts/docker-deploy.sh stop             # 停止并移除容器
#   ./scripts/docker-deploy.sh logs             # 查看容器日志
#
# 环境变量（可选）:
#   DOCKER_IMAGE=ws-control-platform            # 镜像名
#   DOCKER_TAG=latest                           # 镜像标签，默认 latest 或 git 短 SHA
#   DOCKER_REGISTRY=ghcr.io/your-org            # 镜像仓库前缀，不设则只本地 tag
#   ENV_FILE=.env.production                    # compose 使用的 env 文件
#   SKIP_BUILD=1                                # all 时跳过构建
#   SKIP_DEPLOY=1                               # all 时跳过部署
#   SKIP_PUSH=1                                 # all 时跳过推送

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_NAME="${DOCKER_IMAGE:-ws-control-platform}"
REGISTRY="${DOCKER_REGISTRY:-}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ -z "${DOCKER_TAG:-}" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    DOCKER_TAG="$(git rev-parse --short HEAD)"
  else
    DOCKER_TAG="latest"
  fi
fi

LOCAL_IMAGE="${IMAGE_NAME}:${DOCKER_TAG}"
REMOTE_IMAGE=""
if [[ -n "$REGISTRY" ]]; then
  REMOTE_IMAGE="${REGISTRY%/}/${IMAGE_NAME}:${DOCKER_TAG}"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[docker]${NC} $*"; }
warn()  { echo -e "${YELLOW}[docker]${NC} $*"; }
error() { echo -e "${RED}[docker]${NC} $*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "缺少命令: $1"
    exit 1
  fi
}

resolve_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    echo "$ENV_FILE"
    return
  fi
  if [[ -f ".env.production.example" ]]; then
    warn "未找到 ${ENV_FILE}，使用 .env.production.example"
    echo ".env.production.example"
    return
  fi
  if [[ -f ".env.example" ]]; then
    warn "未找到 ${ENV_FILE}，使用 .env.example"
    echo ".env.example"
    return
  fi
  error "未找到环境变量文件，请先创建 ${ENV_FILE}"
  exit 1
}

cmd_build() {
  require_cmd docker
  info "构建镜像: ${LOCAL_IMAGE}"
  docker build -t "${LOCAL_IMAGE}" -f Dockerfile .
  docker tag "${LOCAL_IMAGE}" "${IMAGE_NAME}:latest"
  info "构建完成: ${LOCAL_IMAGE} (同时标记 ${IMAGE_NAME}:latest)"
}

cmd_publish() {
  require_cmd docker
  if [[ -z "$REMOTE_IMAGE" ]]; then
    error "未设置 DOCKER_REGISTRY，无法推送。示例: DOCKER_REGISTRY=ghcr.io/your-org"
    exit 1
  fi

  if ! docker image inspect "${LOCAL_IMAGE}" >/dev/null 2>&1; then
    warn "本地镜像 ${LOCAL_IMAGE} 不存在，先执行构建..."
    cmd_build
  fi

  info "标记远程镜像: ${REMOTE_IMAGE}"
  docker tag "${LOCAL_IMAGE}" "${REMOTE_IMAGE}"
  docker tag "${LOCAL_IMAGE}" "${REGISTRY%/}/${IMAGE_NAME}:latest"

  info "推送 ${REMOTE_IMAGE}"
  docker push "${REMOTE_IMAGE}"
  docker push "${REGISTRY%/}/${IMAGE_NAME}:latest"
  info "推送完成"
}

cmd_deploy() {
  require_cmd docker
  local env_path
  env_path="$(resolve_env_file)"

  info "使用环境文件: ${env_path}"
  info "启动服务 (docker compose up -d --build)"

  DOCKER_IMAGE="${IMAGE_NAME}" DOCKER_TAG="${DOCKER_TAG}" \
    docker compose --env-file "${env_path}" up -d --build --remove-orphans

  info "部署完成"
  info "访问地址: http://localhost:8080 (host 网络模式下以实际端口为准)"
  docker compose ps
}

cmd_stop() {
  require_cmd docker
  local env_path
  env_path="$(resolve_env_file)"
  info "停止服务..."
  docker compose --env-file "${env_path}" down
  info "已停止"
}

cmd_logs() {
  require_cmd docker
  local env_path
  env_path="$(resolve_env_file)"
  docker compose --env-file "${env_path}" logs -f --tail=200
}

cmd_all() {
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    cmd_build
  else
    warn "SKIP_BUILD=1，跳过构建"
  fi

  if [[ "${SKIP_DEPLOY:-0}" != "1" ]]; then
    cmd_deploy
  else
    warn "SKIP_DEPLOY=1，跳过部署"
  fi

  if [[ "${SKIP_PUSH:-0}" != "1" ]]; then
    if [[ -n "$REMOTE_IMAGE" ]]; then
      cmd_publish
    else
      warn "未设置 DOCKER_REGISTRY，跳过推送（仅本地部署）"
    fi
  else
    warn "SKIP_PUSH=1，跳过推送"
  fi

  info "全部流程完成"
}

usage() {
  cat <<EOF
ws-control-platform Docker 一键脚本

用法:
  $0 <command>

命令:
  build     构建 Docker 镜像
  deploy    本地 docker compose 部署
  publish   推送镜像到远程仓库（需 DOCKER_REGISTRY）
  all       构建 + 部署 + 推送（默认）
  stop      停止并移除容器
  logs      查看容器日志

示例:
  $0 all
  DOCKER_REGISTRY=ghcr.io/myorg DOCKER_TAG=v1.0.0 $0 all
  SKIP_PUSH=1 $0 all
  ENV_FILE=.env.production $0 deploy

当前配置:
  IMAGE=${LOCAL_IMAGE}
  REGISTRY=${REGISTRY:-<未设置，仅本地>}
  ENV_FILE=${ENV_FILE}
EOF
}

main() {
  local cmd="${1:-all}"
  case "$cmd" in
    build)   cmd_build ;;
    deploy)  cmd_deploy ;;
    publish) cmd_publish ;;
    all)     cmd_all ;;
    stop)    cmd_stop ;;
    logs)    cmd_logs ;;
    -h|--help|help) usage ;;
    *)
      error "未知命令: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
