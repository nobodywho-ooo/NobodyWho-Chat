import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelCard } from 'components';
import { modelDownloadProgress } from 'repositories';
import { Model, ModelDownload } from 'types';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface DownloadingModelsProps {
  downloads: ModelDownload[];
  onStopPress: (model: Model) => void;
}

export const DownloadingModels: React.FC<DownloadingModelsProps> = ({
  downloads,
  onStopPress,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <SectionHeader title={t('screens.models.downloading')} />
      {downloads.map(download => (
        <ModelCard
          key={download.model.id}
          model={download.model}
          downloadProgress={modelDownloadProgress(download)}
          onPress={onStopPress}
        />
      ))}
    </>
  );
};
