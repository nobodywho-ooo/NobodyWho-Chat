import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelCard } from 'components';
import { Model } from 'types';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface InUseModelsProps {
  models: Model[];
}

export const InUseModels: React.FC<InUseModelsProps> = ({ models }) => {
  const { t } = useTranslation();

  return (
    <>
      <SectionHeader first title={t('screens.models.inUse')} />
      {models.map(model => (
        <ModelCard key={model.id} isSelected model={model} />
      ))}
    </>
  );
};
