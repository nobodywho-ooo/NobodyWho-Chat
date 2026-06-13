#import "RTNClipboard.h"

#import <UIKit/UIKit.h>

@implementation RTNClipboard

+ (NSString *)moduleName
{
  return @"NativeClipboard";
}

- (void)setString:(NSString *)content
{
  NSString *value = content ?: @"";
  dispatch_async(dispatch_get_main_queue(), ^{
    UIPasteboard.generalPasteboard.string = value;
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRTNClipboardSpecJSI>(params);
}

@end
