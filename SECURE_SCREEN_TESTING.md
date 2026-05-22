# Android 安全界面 — 验收清单

## 场景 1: 锁屏 PIN（非 Root，镜像模式）

- [ ] 设备进入锁屏状态后，Canvas 持续接收到黑帧
- [ ] 约 8 帧后 SecureScreenHint 提示条自动出现，显示 "安全界面，Android 禁止投屏"
- [ ] 提示条中的 "触摸与按键仍可操作" 描述准确
- [ ] 打开 MobileActionDrawer → PIN 盲输面板可见
- [ ] 通过 BlindPinPad 输入正确 PIN（0-9 数字 + 确认）后，设备解锁
- [ ] 解锁后 Canvas 恢复正常画面，SecureScreenHint 自动消失
- [ ] 桌面端 ControlPanel 中 PIN 盲输面板同样可用

## 场景 2: App 内密码/支付界面（非 Root，镜像模式）

- [ ] 进入银行/支付 App 的密码输入界面，Canvas 变黑
- [ ] SecureScreenHint 自动出现
- [ ] 通过 BlindPinPad 或触摸操作可盲输密码
- [ ] 离开密码界面后画面恢复，提示条消失

## 场景 3: 虚拟屏模式（非 Root，virtual_display）

- [ ] 设备配置对话框中 "采集模式" 下拉可选 "虚拟屏"
- [ ] 选择虚拟屏后出现规格输入框和说明文案
- [ ] 连接成功后，Canvas 显示虚拟屏内容（非物理屏镜像）
- [ ] 物理屏锁屏状态不影响虚拟屏画面
- [ ] 虚拟屏模式说明文案清晰：不能用于远程解锁

## 场景 4: Root 启动模式

- [ ] `GET /api/device/root-status?serial=xxx` 返回正确的 root 状态
- [ ] 设备配置对话框中 "安全界面处理" 可选 "Root 启动（实验性）"
- [ ] 选择 Root 启动后出现警告提示
- [ ] 已 Root 设备连接时，scrcpy-server 通过 `su -c` 启动
- [ ] 后端日志输出 `[scrcpy] root server mode enabled`
- [ ] 在部分 ROM 上可显示锁屏/密码界面（视设备兼容性）
- [ ] 非 Root 设备选择此模式时，连接失败并给出明确错误

## 回归验证

- [ ] 普通 App 镜像模式与之前功能一致
- [ ] 触摸、UHID 键盘、文本输入等控制功能正常
- [ ] 移动端/桌面端布局和快捷操作不受影响
- [ ] 新增的配置字段 (captureMode, virtualDisplay, secureCaptureMode) 持久化正常
