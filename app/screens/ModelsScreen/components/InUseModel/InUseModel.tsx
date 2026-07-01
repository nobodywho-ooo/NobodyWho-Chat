import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelCard } from 'components';
import { Model } from 'types';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface InUseModelProps {
  model: Model;
}

export const InUseModel: React.FC<InUseModelProps> = ({ model }) => {
  const { t } = useTranslation();

  return (
    <>
      <SectionHeader first title={t('screens.models.inUse')} />
      <ModelCard isSelected model={model} />
    </>
  );
};
