import React from 'react';
import { ModelCard } from 'components';
import { Model } from 'types';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface InUseModelProps {
  model: Model;
  title: string;
  first?: boolean;
}

export const InUseModel: React.FC<InUseModelProps> = ({
  model,
  title,
  first = true,
}) => {
  return (
    <>
      <SectionHeader first={first} title={title} />
      <ModelCard isSelected model={model} />
    </>
  );
};
