import {
  codegenNativeComponent,
  type ColorValue,
  type CodegenTypes,
  type ViewProps,
} from 'react-native';

/**
 * Paints the background under round children (discs), with the light of the
 * screen's glass rim where a disc comes near an edge: the disc's colour cast
 * onto the rim, blurred and split like light through glass, and a soft neck
 * in its colour reaching out to the edge from the closest disc. Each frame the
 * native side reads where its children are, so they can move however they like.
 */
export interface NativeProps extends ViewProps {
  /** One per child, in order: the colour it casts onto the rim. */
  discColors?: ReadonlyArray<ColorValue>;
  /** The background it paints, under everything. */
  surfaceColor?: ColorValue;
  /** How far from the edge a disc starts reaching for it with a neck, in disc radii. */
  stickiness?: CodegenTypes.WithDefault<CodegenTypes.Float, 1.3>;
  /** How far from the edge a disc starts to light it, in disc radii. */
  glowReach?: CodegenTypes.WithDefault<CodegenTypes.Float, 2.4>;
  /** How deep the glow reaches in from the edge, in points. */
  glowWidth?: CodegenTypes.WithDefault<CodegenTypes.Float, 22>;
  /** Corner radius of the rim, so the light follows the screen's corners. */
  cornerRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, 0>;
}

export default codegenNativeComponent<NativeProps>('EdgeRefractionView');
