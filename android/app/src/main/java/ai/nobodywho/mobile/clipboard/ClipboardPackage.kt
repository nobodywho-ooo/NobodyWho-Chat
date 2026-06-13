package ai.nobodywho.mobile.clipboard

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ClipboardPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      NativeClipboardModule.NAME -> NativeClipboardModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        NativeClipboardModule.NAME to
          ReactModuleInfo(
            NativeClipboardModule.NAME,
            NativeClipboardModule.NAME,
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
      )
    }
}
