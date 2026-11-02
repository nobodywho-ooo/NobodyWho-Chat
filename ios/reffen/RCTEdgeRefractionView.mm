#import "RCTEdgeRefractionView.h"

#import <react/renderer/components/ReffenSpecs/ComponentDescriptors.h>
#import <react/renderer/components/ReffenSpecs/Props.h>
#import <react/renderer/components/ReffenSpecs/RCTComponentViewHelpers.h>

#import <React/RCTConversions.h>

using namespace facebook::react;

// The Swift view in EdgeRefractionLens.swift, declared here rather than through
// reffen-Swift.h: that header also declares AppDelegate and the other Expo
// subclasses, whose superclasses Objective-C++ can't import.
@interface EdgeRefractionLens : UIView

@property (nonatomic, readonly, strong) UIView *contentView;
@property (nonatomic, copy) NSArray<UIColor *> *discColors;
@property (nonatomic, strong) UIColor *surfaceColor;
@property (nonatomic) CGFloat stickiness;
@property (nonatomic) CGFloat glowReach;
@property (nonatomic) CGFloat glowWidth;
@property (nonatomic) CGFloat edgeRadius;

@end

@interface RCTEdgeRefractionView () <RCTEdgeRefractionViewViewProtocol>

@end

@implementation RCTEdgeRefractionView {
  EdgeRefractionLens *_lens;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<EdgeRefractionViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const EdgeRefractionViewProps>();
    _props = defaultProps;

    _lens = [[EdgeRefractionLens alloc] initWithFrame:self.bounds];
    self.contentView = _lens;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newProps = *std::static_pointer_cast<const EdgeRefractionViewProps>(props);

  NSMutableArray<UIColor *> *discColors = [NSMutableArray arrayWithCapacity:newProps.discColors.size()];
  for (const auto &color : newProps.discColors) {
    [discColors addObject:RCTUIColorFromSharedColor(color) ?: UIColor.grayColor];
  }
  _lens.discColors = discColors;

  _lens.surfaceColor = RCTUIColorFromSharedColor(newProps.surfaceColor) ?: UIColor.whiteColor;
  _lens.stickiness = newProps.stickiness;
  _lens.glowReach = newProps.glowReach;
  _lens.glowWidth = newProps.glowWidth;
  _lens.edgeRadius = newProps.cornerRadius;

  [super updateProps:props oldProps:oldProps];
}

// Children go above the painted background, which reads their circles.
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [_lens.contentView insertSubview:childComponentView atIndex:index];
}

- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)childComponentView index:(NSInteger)index
{
  [childComponentView removeFromSuperview];
}

@end
