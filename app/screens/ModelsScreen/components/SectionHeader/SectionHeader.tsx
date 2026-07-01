import React from 'react';
import { Text } from 'components';

import styles from './SectionHeader.styles';

interface SectionHeaderProps {
  title: string;
  first?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  first,
}) => (
  <Text variant="h4" style={first ? styles.firstHeader : styles.header}>
    {title}
  </Text>
);
