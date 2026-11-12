import React, { useCallback, useEffect, useRef } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, PlatformIcon, Text } from 'components';
import { holdForeground, log } from 'helpers';
import { Spacings } from 'style';

import { styles } from './CameraCaptureModal.styles';

export interface CapturedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

interface CameraCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: CapturedPhoto) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  visible,
  onClose,
  onCapture,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const granted = permission?.granted ?? false;
  const canAskAgain = permission?.canAskAgain ?? true;

  const askForPermission = useCallback(
    () =>
      holdForeground(requestPermission).catch(error =>
        log('CameraCaptureModal requestPermission', error),
      ),
    [requestPermission],
  );

  const askedThisOpenRef = useRef(false);
  const hasPermissionAnswer = permission !== null;

  useEffect(() => {
    if (!visible) {
      askedThisOpenRef.current = false;
      return;
    }

    if (
      hasPermissionAnswer &&
      !granted &&
      canAskAgain &&
      !askedThisOpenRef.current
    ) {
      askedThisOpenRef.current = true;
      askForPermission();
    }
  }, [visible, hasPermissionAnswer, granted, canAskAgain, askForPermission]);

  const handleCapture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo) {
        onCapture({ uri: photo.uri, width: photo.width, height: photo.height });
      }
    } catch (error) {
      log('CameraCaptureModal capture failed', error, { capture: true });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        ) : (
          <View style={styles.permissionContainer}>
            <Text variant="body1" style={styles.permissionText}>
              {t('components.cameraCapture.permission')}
            </Text>
            <Button
              title={t(
                canAskAgain
                  ? 'components.cameraCapture.grant'
                  : 'components.cameraCapture.openSettings',
              )}
              onPress={canAskAgain ? askForPermission : Linking.openSettings}
            />
          </View>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('components.cameraCapture.close')}
          style={[styles.closeButton, { top: insets.top + Spacings.md }]}
        >
          <PlatformIcon
            iosIconName="xmark"
            androidIconName="close"
            color="#fff"
            size={24}
          />
        </Pressable>

        {granted && (
          <View
            style={[
              styles.controlsContainer,
              { paddingBottom: insets.bottom + Spacings.xl },
            ]}
          >
            <Pressable
              onPress={handleCapture}
              accessibilityRole="button"
              accessibilityLabel={t('components.inputBar.attachCamera')}
              style={styles.shutter}
            >
              <View style={styles.shutterContainer} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};
