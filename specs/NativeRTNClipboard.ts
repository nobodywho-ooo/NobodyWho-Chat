import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  setString(content: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeClipboard');
