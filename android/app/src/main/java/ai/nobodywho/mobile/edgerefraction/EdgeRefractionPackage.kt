package ai.nobodywho.mobile.edgerefraction

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class EdgeRefractionPackage : ReactPackage {

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<in Nothing, in Nothing>> = listOf(EdgeRefractionViewManager())
}
