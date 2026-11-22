import { useEffect, useRef } from 'react';

interface AttachTrayCollapseOptions {
  attachExpanded: boolean;
  canAttach: boolean;
  hasImage: boolean;
  hasAudio: boolean;
  onAttachExpandedChange: (expanded: boolean) => void;
}

// Closes the attach tray once it has done its job / can't be used any more
export const useAttachTrayCollapse = ({
  attachExpanded,
  canAttach,
  hasImage,
  hasAudio,
  onAttachExpandedChange,
}: AttachTrayCollapseOptions) => {
  const prevAttachments = useRef({ hasImage, hasAudio });

  useEffect(() => {
    const addedImage = hasImage && !prevAttachments.current.hasImage;
    const addedAudio = hasAudio && !prevAttachments.current.hasAudio;

    if (addedImage || addedAudio) {
      onAttachExpandedChange(false);
    }

    prevAttachments.current = { hasImage, hasAudio };
  }, [hasImage, hasAudio, onAttachExpandedChange]);

  useEffect(() => {
    if (attachExpanded && !canAttach) {
      onAttachExpandedChange(false);
    }
  }, [attachExpanded, canAttach, onAttachExpandedChange]);
};
