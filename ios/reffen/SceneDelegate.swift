internal import Expo

/// The iOS 27 SDK (Xcode 27) requires apps to adopt the UIScene life cycle: UIKit refuses to
/// launch an app that still builds its window from `application(_:didFinishLaunchingWithOptions:)`
/// ("UIScene life cycle is required for apps built with this SDK").
///
/// `ExpoAppSceneDelegate` (Expo SDK 58) creates the window once the scene connects, starts the
/// factory `AppDelegate` built (module name from `reactNativeFactoryModuleName`), mirrors the
/// window onto `AppDelegate.window`, and forwards scene life-cycle, URL and user-activity events
/// to `ExpoAppDelegate` subscribers.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
}
