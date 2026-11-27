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

    ReactScrollEdgeEffects.hide()

    // The window is created and React Native is started by `SceneDelegate` — the UIScene
    // life cycle is mandatory for apps built against the iOS 27 SDK (Xcode 27).

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Info.plist lists landscape so foldables run full screen: iPhone Duo's inner display is
  /// landscape-native (951x669 pt). Other iPhones stay portrait-only, as before.
  ///
  /// Decided by the device, never by the screen or window size: since iOS 27 iPhone apps are
  /// resizable and an orientation lock is only a preference, so a portrait lock from the cover
  /// display makes iOS show the app in a 469-pt portrait window once the Duo opens — and that
  /// window is all `UIScreen.bounds` then reports, so a size check keeps the lock forever.
  override func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    let mask = super.application(application, supportedInterfaceOrientationsFor: window)
    guard UIDevice.current.userInterfaceIdiom == .phone, !FoldableDevice.isFoldable else {
      return mask
    }
    return mask.intersection(.portrait)
  }
}

/// iOS 26 gives every scroll view under a native bar a "scroll edge effect": a frosted band, cut
/// off by a hard line, under the header. The app draws its own progressive blur there
/// (`GlassScrollEdge`). react-native-screens' `scrollEdgeEffects` option can't turn it off: it
/// looks for the screen's scroll view when the screen mounts, before React has added it. So it is
/// turned off on every React Native scroll view as it enters a window.
enum ReactScrollEdgeEffects {
  @MainActor
  static func hide() {
    guard #available(iOS 26.0, *),
          let scrollViewClass = NSClassFromString("RCTEnhancedScrollView"),
          let method = class_getInstanceMethod(scrollViewClass, #selector(UIView.didMoveToWindow))
    else {
      return
    }
    let selector = #selector(UIView.didMoveToWindow)
    typealias DidMoveToWindow = @convention(c) (AnyObject, Selector) -> Void
    let original = unsafeBitCast(method_getImplementation(method), to: DidMoveToWindow.self)
    let replacement: @convention(block) (UIScrollView) -> Void = { scrollView in
      original(scrollView, selector)
      scrollView.topEdgeEffect.isHidden = true
      scrollView.bottomEdgeEffect.isHidden = true
      scrollView.leftEdgeEffect.isHidden = true
      scrollView.rightEdgeEffect.isHidden = true
    }
    let implementation = imp_implementationWithBlock(replacement)
    // Added when the class only inherits the method, so UIView's own stays untouched.
    if !class_addMethod(
      scrollViewClass, selector, implementation, method_getTypeEncoding(method)
    ) {
      method_setImplementation(method, implementation)
    }
  }
}

/// Whether this iPhone folds, like iPhone Duo. Known models are recognised from the first launch;
/// any other device is recognised once its window reports a hinge (`observeHinge`), which is
/// remembered for later launches.
enum FoldableDevice {
  private static let knownModels: Set<String> = [
    "iPhone19,4", // iPhone Duo
  ]
  private static let hingeSeenKey = "FoldableDevice.hingeSeen"

  static var isFoldable: Bool {
    knownModels.contains(modelIdentifier) || UserDefaults.standard.bool(forKey: hingeSeenKey)
  }

  /// Unlocks landscape as soon as the window reports a hinge. UIKit only reports it to a view
  /// in a window, after launch, so this can't answer the first orientation query by itself.
  @MainActor
  static func observeHinge(in window: UIWindow?) {
#if canImport(UIKit, _version: 9127.0.85) // iOS 27.1 SDK
    guard #available(iOS 27.1, *), let window, !isFoldable else {
      return
    }
    let interaction = UIHingeInteraction { [weak window] interaction, update in
      guard update.hinge != nil else {
        return
      }
      UserDefaults.standard.set(true, forKey: hingeSeenKey)
      window?.removeInteraction(interaction)
      window?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
    window.addInteraction(interaction)
#endif
  }

  private static let modelIdentifier: String = {
    if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
      return simulated
    }
    var systemInfo = utsname()
    uname(&systemInfo)
    return withUnsafeBytes(of: &systemInfo.machine) { bytes in
      String(decoding: bytes.prefix { $0 != 0 }, as: UTF8.self)
    }
  }()
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
