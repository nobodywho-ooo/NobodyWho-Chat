package ai.nobodywho.mobile.clipboard

import ai.nobodywho.mobile.specs.NativeRTNClipboardSpec
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = NativeClipboardModule.NAME)
class NativeClipboardModule(reactContext: ReactApplicationContext) :
  NativeRTNClipboardSpec(reactContext) {

  override fun setString(content: String?) {
    val clipboard =
      reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(null, content.orEmpty()))
  }

  companion object {
    const val NAME = "NativeClipboard"
  }
}
