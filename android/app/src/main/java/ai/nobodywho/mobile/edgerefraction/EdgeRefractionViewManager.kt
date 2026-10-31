package ai.nobodywho.mobile.edgerefraction

import android.graphics.Color
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp

@ReactModule(name = EdgeRefractionViewManager.NAME)
class EdgeRefractionViewManager : ViewGroupManager<EdgeRefractionView>() {

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): EdgeRefractionView =
    EdgeRefractionView(context)

  @ReactProp(name = "discColors")
  fun setDiscColors(view: EdgeRefractionView, value: ReadableArray?) {
    // Processed colours arrive as numbers; past Int.MAX_VALUE they're unsigned ARGB.
    view.discColors = IntArray(value?.size() ?: 0) { value!!.getDouble(it).toLong().toInt() }
  }

  @ReactProp(name = "surfaceColor", customType = "Color")
  fun setSurfaceColor(view: EdgeRefractionView, value: Int?) {
    view.surfaceColor = value ?: Color.WHITE
  }

  @ReactProp(name = "stickiness", defaultFloat = 1.3f)
  fun setStickiness(view: EdgeRefractionView, value: Float) {
    view.stickiness = value
  }

  @ReactProp(name = "glowReach", defaultFloat = 2.4f)
  fun setGlowReach(view: EdgeRefractionView, value: Float) {
    view.glowReach = value
  }

  @ReactProp(name = "glowWidth", defaultFloat = 22f)
  fun setGlowWidth(view: EdgeRefractionView, value: Float) {
    view.glowWidth = value
  }

  @ReactProp(name = "cornerRadius", defaultFloat = 0f)
  fun setCornerRadius(view: EdgeRefractionView, value: Float) {
    view.edgeRadius = value
  }

  override fun onAfterUpdateTransaction(view: EdgeRefractionView) {
    super.onAfterUpdateTransaction(view)
    view.invalidate()
  }

  companion object {
    const val NAME = "EdgeRefractionView"
  }
}
