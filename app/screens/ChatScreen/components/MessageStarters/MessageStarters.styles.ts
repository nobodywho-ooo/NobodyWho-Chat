import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

const STARTER_RADIUS = 16;
const GLASS_BLEED = Spacings.sm;

export default StyleSheet.create({
  // The horizontal ScrollView clips to its bounds, which cut off the glass
  // edge highlight and shadow drawn just outside each chip. Room to draw
  // them goes inside the content, and the list's negative margin takes it
  // back so the row sits where it did.
  list: {
    marginTop: -GLASS_BLEED,
    marginBottom: Spacings.sm - GLASS_BLEED,
  },
  listContent: {
    paddingHorizontal: Spacings.md,
    paddingVertical: GLASS_BLEED,
    columnGap: Spacings.sm,
  },
  starterContainer: {
    paddingHorizontal: Spacings.lg,
    paddingVertical: Spacings.md,
    borderRadius: STARTER_RADIUS,
  },
  starterPressed: {
    opacity: 0.6,
  },
  glassStarter: {
    borderCurve: 'continuous',
  },
  glass: {
    ...StyleSheet.absoluteFill,
    borderRadius: STARTER_RADIUS,
    borderCurve: 'continuous',
  },
});
