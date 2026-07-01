import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import {
  captureImageToMessageDocuments,
  deleteMessageDocuments,
  haptics,
  log,
  pickAudioToMessageDocuments,
  pickImageToMessageDocuments,
} from 'helpers';

import { CapturedPhoto } from '../components/CameraCaptureModal/CameraCaptureModal';
import { ImageAttachSource } from '../components/InputBar/InputBar';

export interface AttachedDocuments {
  imagePath?: string;
  imageSource?: ImageAttachSource;
  audioPath?: string;
}

export const pendingDocumentPaths = (
  documents: AttachedDocuments | null,
): string[] =>
  [documents?.imagePath, documents?.audioPath].filter(
    (path): path is string => typeof path === 'string',
  );

interface UseAttachmentsOptions {
  ingestsImage: boolean;
  ingestsAudio: boolean;
}

export interface Attachments {
  attachedDocuments: AttachedDocuments | null;
  cameraVisible: boolean;
  setCameraVisible: (visible: boolean) => void;
  handleAttachImage: () => Promise<void>;
  handleAttachCamera: () => void;
  handleCapturePhoto: (photo: CapturedPhoto) => Promise<void>;
  handleAttachAudio: () => Promise<void>;
  clearAllAttachments: () => void;
  clearAttachmentsAfterSend: (sentPaths: string[]) => void;
}

export function useAttachments({
  ingestsImage,
  ingestsAudio,
}: UseAttachmentsOptions): Attachments {
  const [attachedDocuments, setAttachedDocuments] =
    useState<AttachedDocuments | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);

  const attachedDocumentsRef = useRef(attachedDocuments);
  attachedDocumentsRef.current = attachedDocuments;

  useEffect(() => {
    return () => {
      const orphans = pendingDocumentPaths(attachedDocumentsRef.current);
      if (orphans.length > 0) {
        deleteMessageDocuments(orphans);
      }
    };
  }, []);

  const clearAllAttachments = useCallback(() => {
    const orphans = pendingDocumentPaths(attachedDocumentsRef.current);
    if (orphans.length > 0) {
      deleteMessageDocuments(orphans);
      setAttachedDocuments(null);
    }
  }, []);

  const clearAttachmentsAfterSend = useCallback((sentPaths: string[]) => {
    const sent = new Set(sentPaths);
    const orphans = pendingDocumentPaths(attachedDocumentsRef.current).filter(
      path => !sent.has(path),
    );
    if (orphans.length > 0) {
      deleteMessageDocuments(orphans);
    }
    setAttachedDocuments(null);
  }, []);

  const clearAttachedImage = () => {
    const imagePath = attachedDocuments?.imagePath;
    if (imagePath) {
      deleteMessageDocuments([imagePath]);
    }
    setAttachedDocuments(prev =>
      prev ? { ...prev, imagePath: undefined, imageSource: undefined } : prev,
    );
  };

  const handleAttachImage = async () => {
    if (!ingestsImage) {
      return;
    }

    if (attachedDocuments?.imagePath) {
      clearAttachedImage();
      return;
    }

    try {
      const imagePath = await pickImageToMessageDocuments();
      if (imagePath) {
        setAttachedDocuments(prev => ({
          ...prev,
          imagePath,
          imageSource: 'photo',
        }));
        haptics.light();
      }
    } catch (error) {
      log('ChatScreen attach image failed', error, { capture: true });
    }
  };

  const handleAttachCamera = () => {
    if (!ingestsImage) {
      return;
    }

    if (attachedDocuments?.imagePath) {
      clearAttachedImage();
      return;
    }

    Keyboard.dismiss();
    setCameraVisible(true);
  };

  const handleCapturePhoto = async (photo: CapturedPhoto) => {
    setCameraVisible(false);

    try {
      const imagePath = await captureImageToMessageDocuments(photo);
      setAttachedDocuments(prev => ({
        ...prev,
        imagePath,
        imageSource: 'camera',
      }));
      haptics.light();
    } catch (error) {
      log('ChatScreen capture image failed', error, { capture: true });
    }
  };

  const handleAttachAudio = async () => {
    if (!ingestsAudio) {
      return;
    }

    if (attachedDocuments?.audioPath) {
      deleteMessageDocuments([attachedDocuments.audioPath]);
      setAttachedDocuments(prev =>
        prev ? { ...prev, audioPath: undefined } : prev,
      );
      return;
    }

    try {
      const audioPath = await pickAudioToMessageDocuments();
      if (audioPath) {
        setAttachedDocuments(prev => ({ ...prev, audioPath }));
        haptics.light();
      }
    } catch (error) {
      log('ChatScreen attach audio failed', error, { capture: true });
    }
  };

  return {
    attachedDocuments,
    cameraVisible,
    setCameraVisible,
    handleAttachImage,
    handleAttachCamera,
    handleCapturePhoto,
    handleAttachAudio,
    clearAllAttachments,
    clearAttachmentsAfterSend,
  };
}
