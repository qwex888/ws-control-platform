---
description: 涉及 scrcpy 协议消息格式的编码铁律，适用于新增或修改 controlRelay / uhidKeyboard / videoRelay 等二进制协议相关代码
globs:
  - services/gateway/src/stream/**
  - services/gateway/src/adb/scrcpy.ts
alwaysApply: false
---

# scrcpy 协议编码铁律

## 核心原则

涉及二进制消息序列化/反序列化的代码（controlRelay.ts、uhidKeyboard.ts、videoRelay.ts 等），
**禁止凭记忆、推测或训练数据编写消息格式**。必须对照 scrcpy 官方源码逐字段确认。

## 强制要求

1. **逐字段对照源码**
   - 序列化：对照 `control_msg.c` 中 `sc_control_msg_serialize()` 的对应 case
   - 反序列化：对照 `ControlMessageReader.java` 中对应的 `parseXxx()` 方法
   - 两端必须同时校验，确认字段顺序、字节宽度、编码方式完全一致

2. **字节宽度零容忍**
   - i16 与 i32、u16 与 u32 混淆会导致控制流永久错位，后续所有消息全部损坏
   - 每个字段必须明确注释字节宽度：`// hscroll: i16fp (2 bytes)` 而非 `// hscroll`
   - Buffer.alloc 的大小必须等于所有字段宽度之和，写完后 offset 必须等于 buffer.length

3. **消息类型常量严格匹配**
   - 所有 `TYPE_*` 常量值必须与 `ControlMessage.java` 的枚举定义一一对应
   - scrcpy v4.0 枚举顺序：
     ```
     INJECT_KEYCODE=0, INJECT_TEXT=1, INJECT_TOUCH_EVENT=2,
     INJECT_SCROLL_EVENT=3, BACK_OR_SCREEN_ON=4,
     EXPAND_NOTIFICATION_PANEL=5, EXPAND_SETTINGS_PANEL=6,
     COLLAPSE_PANELS=7, GET_CLIPBOARD=8, SET_CLIPBOARD=9,
     SET_DISPLAY_POWER=10, ROTATE_DEVICE=11,
     UHID_CREATE=12, UHID_INPUT=13, UHID_DESTROY=14,
     OPEN_HARD_KEYBOARD_SETTINGS=15, RESET_VIDEO=16,
     RESIZE_DISPLAY=17, START_APP=18
     ```

4. **测试必须同步更新**
   - 每新增或修改一种消息格式，必须在 `__tests__/control-relay.test.ts` 中同步新增/更新测试
   - 测试必须验证：总字节数、type 字节值、每个字段的偏移和值
   - 必须包含边界值测试（0、负数、最大值）

5. **固定点编码需注明精度**
   - u16fp = float * 0xFFFF（无符号，用于 pressure）
   - i16fp = float * 0x7FFF（有符号，用于 scroll）
   - i32fp 在 scrcpy v4.0 的 scroll 中已不再使用

## 禁止行为

- ❌ 不查阅源码直接编写二进制消息格式
- ❌ 从旧版 scrcpy 文档推测新版格式
- ❌ 修改消息格式后不运行/不更新测试
- ❌ Buffer 大小与字段宽度之和不一致
- ❌ 注释中的 type 值、字节数与实际代码不一致
