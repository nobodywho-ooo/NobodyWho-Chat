import { getPipelineIcon } from '../pipelineIcon';
import { ModelPipeline } from 'types';

describe('getPipelineIcon', () => {
  test('gives every known pipeline its own pair of platform icons', () => {
    const pipelines = Object.values(ModelPipeline);
    const icons = pipelines.map(getPipelineIcon);

    for (const icon of icons) {
      expect(icon.iosIconName).toBeTruthy();
      expect(icon.androidIconName).toBeTruthy();
    }

    // Distinct per pipeline: a duplicate would mean two pipelines are
    // indistinguishable wherever only the icon is shown.
    expect(new Set(icons.map(icon => icon.iosIconName)).size).toBe(
      pipelines.length,
    );
  });

  test('falls back to a generic icon for a pipeline this build does not know', () => {
    const icon = getPipelineIcon('somethingNew' as ModelPipeline);

    expect(icon).toEqual({
      iosIconName: 'shippingbox',
      androidIconName: 'category',
    });
  });
});
