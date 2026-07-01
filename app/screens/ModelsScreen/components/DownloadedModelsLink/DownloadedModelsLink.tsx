import React from 'react';
import { useTranslation } from 'react-i18next';
import { ListItem } from 'components';
import { useStyled } from 'hooks';

import { SectionHeader } from '../SectionHeader/SectionHeader';

interface DownloadedModelsLinkProps {
  count: number;
  first: boolean;
  onPress: () => void;
}

export const DownloadedModelsLink: React.FC<DownloadedModelsLinkProps> = ({
  count,
  first,
  onPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <>
      <SectionHeader first={first} title={t('screens.models.readyToUse')} />
      <ListItem
        title={t('screens.models.downloaded')}
        subtitle={t('screens.models.modelCount', { count })}
        iosIconName={'arrow.down.circle.fill'}
        androidIconName={'deployed_code_update'}
        iconBackgroundColor={colors.primary}
        onPress={onPress}
      />
    </>
  );
};
