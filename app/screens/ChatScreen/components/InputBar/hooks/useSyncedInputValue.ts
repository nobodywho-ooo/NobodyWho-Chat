import { useCallback, useState } from 'react';
import { isIOS } from 'helpers';

// iOS doesn't grow a multiline TextInput to fit a value set from outside (a
// message starter, a dictation), so such a value remounts the field via
// `inputKey`. Text the user types goes through `handleChangeText` and keeps
// the same field.
//
// Clearing from outside (sending) remounts it too: the old field would shrink
// later, on the native text update, and the input bar's container keeps its
// multi-line height through that update — the bar floated above the bottom
// until its next render, the end of the answer.
export const useSyncedInputValue = (
  value: string,
  onChangeText: (text: string) => void,
) => {
  const [syncedValue, setSyncedValue] = useState(value);
  const [inputKey, setInputKey] = useState(0);

  if (value !== syncedValue) {
    setSyncedValue(value);
    if (isIOS) {
      setInputKey(key => key + 1);
    }
  }

  const handleChangeText = useCallback(
    (text: string) => {
      setSyncedValue(text);
      onChangeText(text);
    },
    [onChangeText],
  );

  return { inputKey, handleChangeText };
};
