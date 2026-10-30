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
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  /// The iOS 27 SDK turns the app-level status bar setters into no-ops, so `StatusBar` only works
  /// with `UIViewControllerBasedStatusBarAppearance` = YES and a root view controller that returns
  /// the style set from JS. Expo's delegate returns a plain `UIViewController`, which doesn't.
  override func createRootViewController() -> UIViewController {
    StatusBarRootViewController()
  }

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

/// Mirrors React Native's default `RCTRootViewController`: reports the `StatusBar` state set from JS.
class StatusBarRootViewController: UIViewController {
  override var preferredStatusBarStyle: UIStatusBarStyle { RCTStatusBarAppearance.style }
  override var prefersStatusBarHidden: Bool { RCTStatusBarAppearance.hidden }
  override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
    RCTStatusBarAppearance.updateAnimation
  }
}
