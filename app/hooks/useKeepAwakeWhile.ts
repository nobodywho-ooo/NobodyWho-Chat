import { useEffect, useId } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { log } from 'helpers';

export const useKeepAwakeWhile = (active: boolean) => {
  const tag = useId();
  const isFocused = useIsFocused();
  const shouldKeepAwake = active && isFocused;

  useEffect(() => {
    if (!shouldKeepAwake) {
      return;
    }

    activateKeepAwakeAsync(tag).catch(error =>
      log('useKeepAwakeWhile activate', error),
    );

    return () => {
      deactivateKeepAwake(tag).catch(error =>
        log('useKeepAwakeWhile deactivate', error),
      );
    };
  }, [shouldKeepAwake, tag]);
};
