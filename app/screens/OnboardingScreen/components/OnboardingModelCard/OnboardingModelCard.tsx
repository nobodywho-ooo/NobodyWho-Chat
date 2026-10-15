import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'components';
import { getFamilyIcon, parameterCountLabel } from 'helpers';
import { useStyled } from 'hooks';
import { Model } from 'types';

import { OnboardingCard } from '../OnboardingCard/OnboardingCard';

const FAMILY_ICON_SIZE = 32;

interface OnboardingModelCardProps {
  model: Model;
  onPress: (model: Model) => void;
}

export const OnboardingModelCard: React.FC<OnboardingModelCardProps> = ({
  model,
  onPress,
}) => {
  const { colors } = useStyled();
  const { t } = useTranslation();
  const { name, parameterCountBillions, sizeGB, family, thinking, languages } =
    model;

  const FamilyIcon = getFamilyIcon(family);
  const parameterLabel = parameterCountLabel(parameterCountBillions);
  const hasTags = languages.length > 0 || thinking;

  const handlePress = useCallback(() => onPress(model), [onPress, model]);

  return (
    <OnboardingCard
      icon={
        FamilyIcon && (
          <FamilyIcon
            width={FAMILY_ICON_SIZE}
            height={FAMILY_ICON_SIZE}
            color={colors.onSurface}
          />
        )
      }
      title={name}
      titleDetail={parameterLabel && `(${parameterLabel})`}
      sizeGB={sizeGB}
      tags={
        hasTags && (
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
        )
      }
      onPress={handlePress}
    />
  );
};
