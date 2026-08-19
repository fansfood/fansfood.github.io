import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error(`Eating Time: failed to load Index, code=${err.code}, message=${err.message}`);
        return;
      }
      console.info('Eating Time HarmonyOS started.');
    });
  }
}
