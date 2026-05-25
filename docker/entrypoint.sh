#!/bin/sh
set -e

# ============================================================
# ADB_MODE 控制 ADB 运行方式:
#   host    - 连接宿主机 ADB server（推荐有 ADB 的用户）
#   local   - 容器内启动独立 ADB server（无需宿主机 ADB）
#   off     - 不启动 ADB（纯前端展示等场景）
# ============================================================
ADB_MODE="${ADB_MODE:-local}"

echo "[ws-control] ADB_MODE=${ADB_MODE}"

case "$ADB_MODE" in
  host)
    # 使用宿主机 ADB server，不启动容器内的 adb
    ADB_TARGET="${ADB_HOST:-host.docker.internal}:${ADB_PORT:-5037}"
    echo "[ws-control] connecting to host ADB server at ${ADB_TARGET}"

    # 等待宿主机 ADB server 可达（最多 10 秒）
    TRIES=0
    while [ "$TRIES" -lt 10 ]; do
      if adb devices >/dev/null 2>&1; then
        echo "[ws-control] host ADB server reachable"
        adb devices
        break
      fi
      TRIES=$((TRIES + 1))
      echo "[ws-control] waiting for host ADB server... (${TRIES}/10)"
      sleep 1
    done

    if [ "$TRIES" -ge 10 ]; then
      echo "[ws-control] WARN: host ADB server not reachable, falling back to local ADB"
      adb start-server 2>/dev/null || echo "[ws-control] WARN: adb start-server failed"
    fi
    ;;

  local)
    # 容器内独立运行 ADB server
    # 密钥持久化在 /root/.android（通过 volume 挂载或 VOLUME 声明）
    echo "[ws-control] starting local ADB server..."

    if [ -f /root/.android/adbkey ]; then
      echo "[ws-control] using existing ADB keys from /root/.android/"
    else
      echo "[ws-control] no ADB keys found, will generate on first connect"
      echo "[ws-control] NOTE: device will show authorization dialog on first connect"
    fi

    adb start-server 2>/dev/null || echo "[ws-control] WARN: adb start-server failed"
    echo "[ws-control] ADB devices:"
    adb devices 2>/dev/null || true
    ;;

  off)
    echo "[ws-control] ADB disabled (ADB_MODE=off)"
    ;;

  *)
    echo "[ws-control] ERROR: unknown ADB_MODE '${ADB_MODE}', expected: host | local | off"
    exit 1
    ;;
esac

# ---- Check frontend ----
echo "[ws-control] checking frontend files..."
if [ -f /usr/share/nginx/html/index.html ]; then
  FILE_COUNT=$(find /usr/share/nginx/html -type f | wc -l)
  echo "[ws-control] frontend OK: ${FILE_COUNT} files"
else
  echo "[ws-control] ERROR: /usr/share/nginx/html/index.html not found!"
  ls -la /usr/share/nginx/html/ 2>/dev/null || true
fi

# ---- Start nginx ----
echo "[ws-control] testing nginx config..."
nginx -t 2>&1

echo "[ws-control] starting nginx (port 28081)..."
nginx &
NGINX_PID=$!
sleep 1

if kill -0 "$NGINX_PID" 2>/dev/null; then
  echo "[ws-control] nginx started (pid=${NGINX_PID})"
else
  echo "[ws-control] ERROR: nginx failed to start"
  exit 1
fi

# ---- Start gateway ----
echo "[ws-control] starting gateway on port ${PORT:-33721}..."
cd /app/services/gateway
exec tsx src/server.ts
