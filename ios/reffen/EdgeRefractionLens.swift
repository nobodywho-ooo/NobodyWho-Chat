import Metal
import QuartzCore
import UIKit

/// Paints the background under round children ("discs"), with the light of
/// the screen's glass rim where a disc comes near an edge: the disc's colour
/// cast onto the rim, blurred and split like light through glass, and a soft
/// neck in its colour reaching out to the edge from the closest disc.
///
/// Nothing is copied from the discs. Each frame their circles are read from
/// the presentation layers of `contentView`'s subviews, whatever moves them
/// (Reanimated, a gesture), and a shader draws the effect from those circles
/// on a Metal layer below them, so the discs simply cover it.
@objc(EdgeRefractionLens)
final class EdgeRefractionLens: UIView {
  /// Where React children mount.
  @objc let contentView = UIView()

  @objc var discColors: [UIColor] = []
  @objc var surfaceColor: UIColor = .white
  @objc var stickiness: CGFloat = 1.3
  @objc var glowReach: CGFloat = 2.4
  @objc var glowWidth: CGFloat = 22
  @objc var edgeRadius: CGFloat = 0

  // Everything drawn is soft: 2x is plenty, and half the pixels of 3x.
  private static let maxRenderScale: CGFloat = 2
  private static let maxDiscs = 16

  private static let device = MTLCreateSystemDefaultDevice()

  private static let pipeline: MTLRenderPipelineState? = {
    guard let device,
      let library = try? device.makeLibrary(source: shaderSource, options: nil)
    else { return nil }

    let descriptor = MTLRenderPipelineDescriptor()
    descriptor.vertexFunction = library.makeFunction(name: "lensVertex")
    descriptor.fragmentFunction = library.makeFunction(name: "lensFragment")
    descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
    return try? device.makeRenderPipelineState(descriptor: descriptor)
  }()

  private let lensLayer = CAMetalLayer()
  private let queue = EdgeRefractionLens.device?.makeCommandQueue()
  // One frame in flight, so a slow GPU frame drops the next instead of
  // blocking the main thread on a drawable.
  private let inFlight = DispatchSemaphore(value: 1)

  private var displayLink: CADisplayLink?

  override init(frame: CGRect) {
    super.init(frame: frame)

    lensLayer.device = Self.device
    lensLayer.pixelFormat = .bgra8Unorm
    lensLayer.isOpaque = false
    lensLayer.framebufferOnly = true
    layer.addSublayer(lensLayer)

    contentView.frame = bounds
    addSubview(contentView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    contentView.frame = bounds

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    lensLayer.frame = bounds
    CATransaction.commit()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()

    displayLink?.invalidate()
    displayLink = nil

    guard window != nil, Self.pipeline != nil else { return }

    let link = CADisplayLink(target: DisplayLinkTarget(self), selector: #selector(DisplayLinkTarget.step))
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 120, preferred: 120)
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  fileprivate func render() {
    // Not settled into a window yet: the trait collection has no scale.
    let scale = min(traitCollection.displayScale, Self.maxRenderScale)
    guard bounds.width > 0, bounds.height > 0, scale > 0,
      let pipeline = Self.pipeline,
      let queue,
      inFlight.wait(timeout: .now()) == .success
    else { return }

    let drawableSize = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    if lensLayer.drawableSize != drawableSize {
      lensLayer.contentsScale = scale
      lensLayer.drawableSize = drawableSize
    }

    guard let drawable = lensLayer.nextDrawable(),
      let commands = queue.makeCommandBuffer()
    else {
      inFlight.signal()
      return
    }

    let pass = MTLRenderPassDescriptor()
    pass.colorAttachments[0].texture = drawable.texture
    pass.colorAttachments[0].loadAction = .clear
    pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
    pass.colorAttachments[0].storeAction = .store

    guard let encoder = commands.makeRenderCommandEncoder(descriptor: pass) else {
      inFlight.signal()
      return
    }

    var discs = readDiscs()
    var uniforms = Uniforms(
      size: SIMD2(Float(bounds.width), Float(bounds.height)),
      radius: Float(edgeRadius),
      stickiness: Float(stickiness),
      glowReach: Float(glowReach),
      glowWidth: Float(glowWidth),
      count: UInt32(discs.count),
      padding: 0,
      surface: Self.components(of: surfaceColor)
    )
    // Metal wants a buffer bound even when there's nothing to read from it.
    if discs.isEmpty {
      discs.append(Disc(geometry: .zero, colour: .zero))
    }

    encoder.setRenderPipelineState(pipeline)
    encoder.setFragmentBytes(&uniforms, length: MemoryLayout<Uniforms>.stride, index: 0)
    encoder.setFragmentBytes(&discs, length: MemoryLayout<Disc>.stride * discs.count, index: 1)
    encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
    encoder.endEncoding()

    commands.addCompletedHandler { [inFlight] _ in inFlight.signal() }
    commands.present(drawable)
    commands.commit()
  }

  /// Each child's circle as it is on screen right now: its layer's position
  /// moved and scaled by its transform (centred, as React Native sets it).
  private func readDiscs() -> [Disc] {
    contentView.subviews.prefix(Self.maxDiscs).enumerated().map { index, view in
      let layer = view.layer.presentation() ?? view.layer
      let transform = layer.transform
      let colour = index < discColors.count ? discColors[index] : .gray

      return Disc(
        geometry: SIMD4(
          Float(layer.position.x + transform.m41),
          Float(layer.position.y + transform.m42),
          Float(layer.bounds.width / 2 * hypot(transform.m11, transform.m12)),
          view.isHidden ? 0 : layer.opacity
        ),
        colour: Self.components(of: colour)
      )
    }
  }

  private static func components(of color: UIColor) -> SIMD4<Float> {
    var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
    color.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
    return SIMD4(Float(red), Float(green), Float(blue), Float(alpha))
  }
}

/// CADisplayLink retains its target: this breaks the cycle with the lens.
private final class DisplayLinkTarget: NSObject {
  private weak var lens: EdgeRefractionLens?

  init(_ lens: EdgeRefractionLens) {
    self.lens = lens
  }

  @objc func step() {
    lens?.render()
  }
}

/// Mirror `Uniforms` and `Disc` in the shader.
private struct Uniforms {
  var size: SIMD2<Float>
  var radius: Float
  var stickiness: Float
  var glowReach: Float
  var glowWidth: Float
  var count: UInt32
  var padding: Float
  var surface: SIMD4<Float>
}

private struct Disc {
  /// Centre x, y and radius in points, then opacity.
  var geometry: SIMD4<Float>
  /// What it casts onto the rim.
  var colour: SIMD4<Float>
}

// Keep in step with `EDGE_SHADER` in EdgeRefractionView.kt.
private let shaderSource = """
#include <metal_stdlib>
using namespace metal;

struct Uniforms {
  float2 size;
  float radius;
  float stickiness;
  float glowReach;
  float glowWidth;
  uint count;
  float padding;
  float4 surface;
};

struct Disc {
  float4 geometry;
  float4 colour;
};

struct Varyings {
  float4 position [[position]];
  float2 uv;
};

// Past this far in from every edge there's only the surface, in points.
constant float REACH = 140.0;
// Edge softness of the neck, in points: the video's is blurry, not crisp.
constant float SOFTNESS = 8.0;
// The neck takes the colour of the disc's rim: its tint this far over the surface.
constant float NECK_TINT = 0.3;
// How strongly the nearest disc colours the rim.
constant float CAST = 0.85;
// Where each channel's blob sits in from the rim, in glow widths: red deeper,
// blue shallower, so the blobs part into colour fringes as light does in glass.
constant float3 SPLIT = float3(0.55, 0.4, 0.25);

vertex Varyings lensVertex(uint id [[vertex_id]]) {
  float2 uv = float2((id << 1) & 2, id & 2);
  Varyings out;
  out.position = float4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  out.uv = uv;
  return out;
}

// Distance in from the rounded rim; negative past it.
static float rimDistance(float2 p, float2 size, float radius) {
  float2 q = abs(p - size * 0.5) - size * 0.5 + radius;
  return -(min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius);
}

// The rim's outward normal nearest to p.
static float2 rimNormal(float2 p, float2 size, float radius) {
  float2 centre = p - size * 0.5;
  float2 q = abs(centre) - size * 0.5 + radius;
  float2 side = float2(centre.x < 0.0 ? -1.0 : 1.0, centre.y < 0.0 ? -1.0 : 1.0);
  if (q.x > 0.0 && q.y > 0.0) {
    return normalize(q) * side;
  }
  return q.x > q.y ? float2(side.x, 0.0) : float2(0.0, side.y);
}

fragment float4 lensFragment(Varyings in [[stage_in]],
                             constant Uniforms &u [[buffer(0)]],
                             constant Disc *discs [[buffer(1)]]) {
  float2 p = in.uv * u.size;
  float3 colour = u.surface.rgb;
  if (rimDistance(p, u.size, u.radius) > REACH) {
    return float4(colour, 1.0);
  }

  for (uint i = 0; i < u.count; i++) {
    float4 g = discs[i].geometry;
    float2 c = g.xy;
    float r = g.z;
    if (g.w < 0.01 || r < 1.0) {
      continue;
    }

    float edge = rimDistance(c, u.size, u.radius);
    float gap = edge - r;
    float neckReach = u.stickiness * r;
    float glowReach = u.glowReach * r;
    if (gap > max(neckReach, glowReach)) {
      continue;
    }

    // A disc passing out through an edge, where the wheel dips off screen,
    // leaves it alone: the effect is for a disc coming up to the glass.
    float present = g.w * smoothstep(-0.25 * r, 0.0, gap);
    if (present < 0.01) {
      continue;
    }

    float2 normal = rimNormal(c, u.size, u.radius);
    float2 tangent = float2(-normal.y, normal.x);
    float3 tint = discs[i].colour.rgb;

    // The neck: a soft bridge from a disc close to the rim, pinched in
    // the middle and flaring at both ends, so it flows out from under the
    // disc and spreads into the light at the edge. It fades in as the disc
    // closes in rather than thinning out, so it never shows as a line.
    float pull = 1.0 - smoothstep(0.2 * r, neckReach, gap);
    if (pull > 0.0 && gap > 0.0) {
      float s = dot(p - c, normal) - r;
      float t = abs(dot(p - c, tangent));
      float a = saturate(s / gap);
      float pinch = sqrt(4.0 * a * (1.0 - a));
      float width = r * mix(mix(0.8, 1.0, a), 0.32, pinch);
      float cover = (1.0 - smoothstep(-SOFTNESS, SOFTNESS, t - width))
        * smoothstep(-0.5 * r, -0.2 * r, s);
      float amount = cover * pull * present * mix(0.85, 0.3, a);
      colour = mix(colour, mix(u.surface.rgb, tint, NECK_TINT), amount);
    }

    // The light: the disc's colour cast onto the rim facing it, a soft blob
    // about the disc's height along the edge, each channel at its own depth.
    // It falls off fast with distance, so only the nearest discs light the
    // rim and the blobs stay apart.
    float2 rel = p - (c + normal * edge);
    float along = dot(rel, tangent);
    float depth = -dot(rel, normal);
    float near = pow(1.0 - smoothstep(0.0, glowReach, gap), 1.5);
    float spread = exp(-along * along / (1.1 * r * r));
    float3 bands = (depth - SPLIT * u.glowWidth) / (0.5 * u.glowWidth);
    float3 cast = CAST * near * spread * present * exp(-bands * bands);
    colour = mix(colour, tint, cast);
  }

  return float4(colour, 1.0);
}
"""
