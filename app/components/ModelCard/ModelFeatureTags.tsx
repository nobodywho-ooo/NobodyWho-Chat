import React from 'react';
import { useTranslation } from 'react-i18next';
import { Model } from 'types';

import { Tag } from '../Tag/Tag';

type FeatureModel = Pick<Model, 'languages' | 'thinking'>;

export const hasModelFeatureTags = ({
  languages,
  thinking,
}: FeatureModel): boolean => languages.length > 0 || thinking;

export const ModelFeatureTags: React.FC<{ model: FeatureModel }> = ({
  model: { languages, thinking },
}) => {
  const { t } = useTranslation();

  return (
    <>
      {languages.length > 0 && (
        <Tag
          iosIconName="globe"
          androidIconName="language"
          label={t('components.modelCard.languageCount', {
            count: languages.length,
          })}
        />
      )}
      {thinking && (
        <Tag
          iosIconName="lightbulb"
          androidIconName="lightbulb"
          label={t('components.modelCard.thinking')}
        />
      )}
    </>
  );
};
