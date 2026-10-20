import React, { useCallback } from 'react';
import { hasModelFeatureTags, ModelFeatureTags } from 'components';
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
  const { name, parameterCountBillions, sizeGB, family } = model;

  const FamilyIcon = getFamilyIcon(family);
  const parameterLabel = parameterCountLabel(parameterCountBillions);

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
      tags={hasModelFeatureTags(model) && <ModelFeatureTags model={model} />}
      onPress={handlePress}
    />
  );
};
