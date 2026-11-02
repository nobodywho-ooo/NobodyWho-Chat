package ai.nobodywho.mobile.edgerefraction

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RuntimeShader
import android.os.Build
import android.view.Choreographer
import androidx.annotation.RequiresApi
import com.facebook.react.views.view.ReactViewGroup
import kotlin.math.min

/**
 * Paints the background under round children ("discs"), with the light of the screen's glass rim
 * where a disc comes near an edge: the disc's colour cast onto the rim, blurred and split like light
 * through glass, and a soft neck in its colour reaching out to the edge from the closest disc.
 *
 * Nothing is copied from the discs: each frame their circles are read from the children's layout
 * and transform, and a shader draws the effect from those circles under them. Needs Android 13
 * (RuntimeShader); earlier versions paint the plain surface.
 */
class EdgeRefractionView(context: Context) : ReactViewGroup(context) {

  var discColors = IntArray(0)
  var surfaceColor = Color.WHITE
  var stickiness = 1.3f
  var glowReach = 2.4f
  var glowWidth = 22f
  var edgeRadius = 0f

  private val shader =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RuntimeShader(EDGE_SHADER) else null
  private val paint = Paint()
  private val geometry = FloatArray(MAX_DISCS * 4)
  private val colours = FloatArray(MAX_DISCS * 4)

  // The children move through their own render-node properties, which don't redraw this view: ask
  // for a frame on every vsync while attached.
  private var ticking = false
  private val frameCallback =
    object : Choreographer.FrameCallback {
      override fun doFrame(frameTimeNanos: Long) {
        if (!ticking) return
        invalidate()
        Choreographer.getInstance().postFrameCallback(this)
      }
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (shader != null && !ticking) {
      ticking = true
      Choreographer.getInstance().postFrameCallback(frameCallback)
    }
  }

  override fun onDetachedFromWindow() {
    ticking = false
    Choreographer.getInstance().removeFrameCallback(frameCallback)
    super.onDetachedFromWindow()
  }

  // The painted background goes first, so the discs simply cover it.
  override fun dispatchDraw(canvas: Canvas) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      drawBackground(canvas)
    } else {
      canvas.drawColor(surfaceColor)
    }
    super.dispatchDraw(canvas)
  }

  @RequiresApi(Build.VERSION_CODES.TIRAMISU)
  private fun drawBackground(canvas: Canvas) {
    val shader = shader ?: return
    if (width == 0 || height == 0) return

    val count = min(childCount, MAX_DISCS)
    for (index in 0 until count) {
      val child = getChildAt(index)
      val offset = index * 4

      // React Native transforms about the centre, so the centre only moves by the translation.
      geometry[offset] = child.left + child.translationX + child.width / 2f
      geometry[offset + 1] = child.top + child.translationY + child.height / 2f
      geometry[offset + 2] = child.width / 2f * child.scaleX
      geometry[offset + 3] = if (child.visibility == VISIBLE) child.alpha else 0f

      val colour = discColors.getOrElse(index) { Color.GRAY }
      colours[offset] = Color.red(colour) / 255f
      colours[offset + 1] = Color.green(colour) / 255f
      colours[offset + 2] = Color.blue(colour) / 255f
      colours[offset + 3] = Color.alpha(colour) / 255f
    }

    // Props are in points; the shader works in pixels.
    val density = resources.displayMetrics.density
    shader.setFloatUniform("size", width.toFloat(), height.toFloat())
    shader.setFloatUniform("unit", density)
    shader.setFloatUniform("radius", edgeRadius * density)
    shader.setFloatUniform("stickiness", stickiness)
    shader.setFloatUniform("glowReach", glowReach)
    shader.setFloatUniform("glowWidth", glowWidth * density)
    shader.setIntUniform("count", count)
    shader.setColorUniform("surface", surfaceColor)
    shader.setFloatUniform("geometry", geometry)
    shader.setFloatUniform("colours", colours)

    paint.shader = shader
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }

  private companion object {
    // Keep in step with the arrays in EDGE_SHADER.
    const val MAX_DISCS = 16

    // Keep in step with `shaderSource` in EdgeRefractionLens.swift.
    const val EDGE_SHADER =
      """
      uniform float2 size;
      uniform float unit;
      uniform float radius;
      uniform float stickiness;
      uniform float glowReach;
      uniform float glowWidth;
      uniform int count;
      layout(color) uniform half4 surface;
      // Centre x, y and radius in pixels, then opacity.
      uniform float4 geometry[16];
      // What each disc casts onto the rim.
      uniform float4 colours[16];

      // Past this far in from every edge there's only the surface, in points.
      const float REACH = 140.0;
      // The neck takes the colour of the disc's rim: its tint this far over the
      // surface.
      const float NECK_TINT = 0.3;
      // How strongly the nearest disc colours the rim.
      const float CAST = 0.85;
      // Where each channel's blob sits in from the rim, in glow widths: red
      // deeper, blue shallower, so the blobs part into colour fringes as light
      // does in glass.
      const float3 SPLIT = float3(0.55, 0.4, 0.25);

      // Distance in from the rounded rim; negative past it.
      float rimDistance(float2 p) {
        float2 q = abs(p - size * 0.5) - size * 0.5 + radius;
        return -(min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius);
      }

      // The rim's outward normal nearest to p.
      float2 rimNormal(float2 p) {
        float2 centre = p - size * 0.5;
        float2 q = abs(centre) - size * 0.5 + radius;
        float2 side = float2(centre.x < 0.0 ? -1.0 : 1.0, centre.y < 0.0 ? -1.0 : 1.0);
        if (q.x > 0.0 && q.y > 0.0) {
          return normalize(q) * side;
        }
        return q.x > q.y ? float2(side.x, 0.0) : float2(0.0, side.y);
      }

      half4 main(float2 p) {
        float3 colour = float3(surface.rgb);
        if (rimDistance(p) > REACH * unit) {
          return half4(half3(colour), 1.0);
        }

        // Edge softness of the neck: the video's is blurry, not crisp.
        float softness = 8.0 * unit;

        for (int i = 0; i < 16; i++) {
          if (i >= count) {
            break;
          }
          float4 g = geometry[i];
          float2 c = g.xy;
          float r = g.z;
          if (g.w < 0.01 || r < unit) {
            continue;
          }

          float edge = rimDistance(c);
          float gap = edge - r;
          float neckReach = stickiness * r;
          float lightReach = glowReach * r;
          if (gap > max(neckReach, lightReach)) {
            continue;
          }

          // A disc passing out through an edge, where the wheel dips off screen,
          // leaves it alone: the effect is for a disc coming up to the glass.
          float present = g.w * smoothstep(-0.25 * r, 0.0, gap);
          if (present < 0.01) {
            continue;
          }

          float2 normal = rimNormal(c);
          float2 tangent = float2(-normal.y, normal.x);
          float3 tint = colours[i].rgb;

          // The neck: a soft bridge from a disc close to the rim, pinched
          // in the middle and flaring at both ends, so it flows out from under
          // the disc and spreads into the light at the edge. It fades in as the
          // disc closes in rather than thinning out, so it never shows as a line.
          float pull = 1.0 - smoothstep(0.2 * r, neckReach, gap);
          if (pull > 0.0 && gap > 0.0) {
            float s = dot(p - c, normal) - r;
            float t = abs(dot(p - c, tangent));
            float a = saturate(s / gap);
            float pinch = sqrt(4.0 * a * (1.0 - a));
            float width = r * mix(mix(0.8, 1.0, a), 0.32, pinch);
            float cover = (1.0 - smoothstep(-softness, softness, t - width))
              * smoothstep(-0.5 * r, -0.2 * r, s);
            float amount = cover * pull * present * mix(0.85, 0.3, a);
            colour = mix(colour, mix(float3(surface.rgb), tint, NECK_TINT), amount);
          }

          // The light: the disc's colour cast onto the rim facing it, a soft
          // blob about the disc's height along the edge, each channel at its own
          // depth. It falls off fast with distance, so only the nearest discs
          // light the rim and the blobs stay apart.
          float2 rel = p - (c + normal * edge);
          float along = dot(rel, tangent);
          float depth = -dot(rel, normal);
          float near = pow(1.0 - smoothstep(0.0, lightReach, gap), 1.5);
          float spread = exp(-along * along / (1.1 * r * r));
          float3 bands = (depth - SPLIT * glowWidth) / (0.5 * glowWidth);
          float3 cast = CAST * near * spread * present * exp(-bands * bands);
          colour = mix(colour, tint, cast);
        }

        return half4(half3(colour), 1.0);
      }
      """
  }
}
