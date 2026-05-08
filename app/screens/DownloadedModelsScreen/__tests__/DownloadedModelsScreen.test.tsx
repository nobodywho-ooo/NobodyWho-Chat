import React from 'react';
import { render } from '@testing-library/react-native';

import { DownloadedModelsScreen } from '../DownloadedModelsScreen';

test('renders correctly ModelsScreen when empty', () => {
  const tree = render(<DownloadedModelsScreen />).toJSON();
  expect(tree).toMatchSnapshot();
});
