# 食光 Eating Time · iOS

当前产品版本：**v1.1.001**  
Apple `CFBundleShortVersionString`：**1.1.1**  
Build：**11001**  
Bundle ID：`io.github.fansfood.eatingtime`

## 架构

iOS 首版复用现有 Capacitor 架构：

- iOS 原生容器：Capacitor / WKWebView
- 正式内容源：`https://fansfood.github.io`
- 云端：继续使用现有 Supabase
- 登录、群组、饭搭子、今日计划、明天吃什么、菜谱、采购、冰箱、AA 账本均复用现有业务数据
- 不复制一套假的本地业务页面

`capacitor.config.json` 是 Android 与 iOS 共用配置源。

## 本地生成 Xcode 工程

需要 macOS、Xcode 和 Node.js：

```bash
npm install
rm -rf ios
npx cap add ios
npx cap sync ios
npx @capacitor/assets generate --ios --iconBackgroundColor '#FFF9F2' --splashBackgroundColor '#FFF9F2'
open ios/App/App.xcworkspace
```

## iPhone 真机

1. Xcode 打开 `ios/App/App.xcworkspace`。
2. 选择 App Target → Signing & Capabilities。
3. 勾选 **Automatically manage signing**。
4. 选择自己的 Apple Developer Team。
5. Bundle Identifier 保持 `io.github.fansfood.eatingtime`；如果该 ID 已被其他 Apple Team 占用，需要在自己的 Developer Team 下换一个唯一 Bundle ID，并同步修改 `capacitor.config.json`。
6. 连接 iPhone，选择该设备作为 Run Destination，点击 Run。

## IPA / TestFlight / App Store

真机可分发 IPA 需要 Apple 签名证书和 Provisioning Profile。配置签名后在 Xcode：

`Product → Archive → Distribute App`

可选择：

- TestFlight / App Store Connect
- Ad Hoc（已注册测试设备）
- Development（开发调试）

## GitHub Actions

`.github/workflows/ios-app.yml` 会在 macOS Runner 上：

1. 自动生成 Capacitor iOS 工程；
2. 生成食光图标/启动资源；
3. 无签名编译 iOS Simulator 版本；
4. 上传 `Eating-Time-iOS-v1.1.001-Simulator.zip` Artifact；
5. 创建 `IOS_SIMULATOR_BUILD_OK v1.1.001` 成功信号。

Simulator Artifact **不能直接安装到普通 iPhone**。实体 iPhone / IPA 需要 Apple Developer 签名资产。

## 后续原生化建议

首版以稳定复用现有业务为目标。真机稳定后再逐步增加：

- iOS 本地通知（采购提醒、明日投票、用餐提醒）
- Share Sheet 系统分享
- 相册/相机原生权限与饭搭子照片上传
- Home Screen Widget：今日早餐 / 午餐 / 晚餐
- App Intents / Shortcuts：快速添加采购、快速打开今日计划
- Haptic Feedback
