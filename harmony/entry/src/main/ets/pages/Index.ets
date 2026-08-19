import { webview } from '@kit.ArkWeb';

const APP_URL: string = 'https://fansfood.github.io/#home';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: APP_URL, controller: this.controller })
        .domStorageAccess(true)
        .javaScriptAccess(true)
        .imageAccess(true)
        .onlineImageAccess(true)
        .fileAccess(true)
        .zoomAccess(false)
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF9F2')
  }
}
