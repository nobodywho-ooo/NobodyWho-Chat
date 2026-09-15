import UIKit
import React
import React_RCTAppDelegate

/// The iOS 27 SDK (Xcode 27) requires apps to adopt the UIScene life cycle: UIKit refuses to
/// launch an app that still builds its window from `application(_:didFinishLaunchingWithOptions:)`
/// ("UIScene life cycle is required for apps built with this SDK").
///
/// React Native's `RCTReactNativeFactory` only needs a window to install the root view
/// controller into, so the window is created here — once the scene connects — and handed
/// to the factory that `AppDelegate` already built.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Several libraries (and RN itself, pre-scene) still read `UIApplication.shared.delegate.window`.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "reffen",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}
