# 食光 Eating Time · HarmonyOS

这是「食光 / Eating Time」现有产品的 HarmonyOS 原生工程目录，当前版本与网站 `v1.1.001` 对齐。

## 技术方案

- HarmonyOS Stage 模型
- ArkTS / ArkUI
- ArkWeb 承载正式站点 `https://fansfood.github.io/#home`
- 继续使用现有 Supabase 登录、群组、饭搭子、投票、采购、冰箱等云端业务数据
- Bundle Name：`io.github.fansfood.eatingtime`

首版鸿蒙工程刻意保持原生外壳精简，不在 ArkTS 中复制网页业务逻辑，避免形成 Android、网页、HarmonyOS 三套相互漂移的数据实现。

## 导入 DevEco Studio

1. 安装当前 HarmonyOS 版本对应的 DevEco Studio 与 HarmonyOS SDK。
2. 使用 DevEco Studio 打开仓库中的 `harmony` 目录。
3. 等待工程同步完成。
4. 在 `File / Project Structure / Signing Configs`（不同版本入口文字可能略有差异）配置 HarmonyOS 自动签名或你的正式签名。
5. 连接 HarmonyOS 真机或启动模拟器。
6. 运行 `entry` 模块。

## 构建

开发调试时可直接使用 DevEco Studio 的 Run/Build 功能。

如果本机 DevEco Studio 已生成并配置好 Hvigor Wrapper，也可以使用对应版本的 `hvigorw` 构建。例如工程级 App 构建通常可使用：

```bash
hvigorw --mode project -p product=default -p buildMode=debug assembleApp
```

具体命令以当前 DevEco Studio / HarmonyOS SDK 生成的 Wrapper 和产品配置为准。

## 安装包说明

- HAP：HarmonyOS 应用的基本安装/运行模块产物。
- APP（App Pack）：用于应用市场分发的应用包集合。
- 真机安装需要有效 HarmonyOS 签名。

本仓库不会提交开发者私钥、证书密码或签名 Profile。正式签名材料应仅保存在开发者自己的安全环境或 CI Secrets 中。

## ArkWeb 配置

`entry/src/main/ets/pages/Index.ets` 已开启：

- DOM Storage：保证网站 localStorage / 会话辅助状态可用
- JavaScript
- 在线图片
- HTTPS 正式站点

`module.json5` 已声明 `ohos.permission.INTERNET`。

## 后续原生化方向

首版稳定后，可以逐步增加 HarmonyOS 原生能力，而不改变现有 Supabase 数据模型：

- 系统通知 / 提醒
- 系统分享
- 桌面卡片
- 原生图片选择器
- 系统返回手势与 ArkWeb 历史记录联动
- 深色模式与系统主题

这些能力应逐项增加并做真机回归，不应一次性重写现有网页业务层。
