import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacings.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.xs,
    marginBottom: Spacings.sm,
  },
  parentChild: {
    rowGap: Spacings.sm,
    columnGap: Spacings.sm,
  },
  button: {
    borderRadius: 10,
    paddingVertical: Spacings.sm,
    paddingHorizontal: Spacings.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  cardChild: {
    rowGap: Spacings.sm,
  },
  divider: {
    backgroundColor: '#9e9e9e',
  },
  dividerHorizontal: {
    height: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
  },
  dividerVertical: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
  },
  image: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e3e3e3',
  },
  fieldContainer: {
    rowGap: Spacings.xs,
  },
  fieldLabel: {
    marginBottom: 2,
  },
  errorText: {
    color: '#c62828',
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: Spacings.sm,
    paddingVertical: Spacings.sm,
    fontSize: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
    paddingVertical: Spacings.xs,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderRow: {
    rowGap: Spacings.xs,
    paddingVertical: Spacings.xs,
  },
  sliderValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
  },
  sliderGrow: {
    flex: 1,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sliderThumb: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    transform: [{ translateX: -8 }],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacings.xs,
  },
  choiceContainer: {
    rowGap: Spacings.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacings.sm,
    paddingVertical: Spacings.xs,
  },
  tabsContainer: {
    rowGap: Spacings.sm,
  },
  tabsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacings.lg,
  },
  tabItem: {
    paddingVertical: Spacings.xs,
    borderBottomWidth: 2,
  },
  tabTitle: {
    includeFontPadding: false,
  },
});
