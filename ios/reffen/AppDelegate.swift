import UIKit
internal import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// Read by `SceneDelegate` (Expo's `ExpoAppSceneDelegate`) when it starts React Native.
  /// Expo defaults to "main"; this app registers its root component as "reffen".
  var reactNativeFactoryModuleName: String { "reffen" }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is created and React Native is started by `SceneDelegate` — the UIScene
    // life cycle is mandatory for apps built against the iOS 27 SDK (Xcode 27).

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Info.plist lists landscape so foldables (iPhone Duo's inner display is landscape-native,
  /// 951x669 pt) run full screen instead of a shrunk, pillarboxed portrait box. Every other
  /// iPhone screen — including the Duo's cover display — stays portrait-only, as before.
  override func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    let mask = super.application(application, supportedInterfaceOrientationsFor: window)
    guard UIDevice.current.userInterfaceIdiom == .phone,
          let screen = window?.windowScene?.screen else {
      return mask
    }
    let shortSide = min(screen.bounds.width, screen.bounds.height)
    return shortSide >= Self.landscapeMinShortSide ? mask : mask.intersection(.portrait)
  }

  /// Same breakpoint as Android's sw600dp: no regular iPhone reaches it (the largest is 440 pt).
  private static let landscapeMinShortSide: CGFloat = 600
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
