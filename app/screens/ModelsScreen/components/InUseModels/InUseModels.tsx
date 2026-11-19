import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelCard, Text } from 'components';
import { Model } from 'types';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface InUseModelsProps {
  models: Model[];
}

export const InUseModels: React.FC<InUseModelsProps> = ({ models }) => {
  const { t } = useTranslation();

  return (
    <>
      <SectionHeader title={t('screens.models.inUse')} />
      {models.length === 0 && <Text>{t('screens.models.noModelInUse')}</Text>}
      {models.map(model => (
        <ModelCard key={model.id} isSelected model={model} />
      ))}
    </>
  );
};
