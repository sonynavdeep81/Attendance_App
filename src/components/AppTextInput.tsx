import React from 'react';
import { TextInput as RNTextInput, TextInputProps, StyleSheet } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';

export const TextInput: React.FC<TextInputProps> = ({ style, ...props }) => {
  const { scale } = useFontScale();
  const flat = StyleSheet.flatten(style) || {};
  const baseFontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 16;

  return (
    <RNTextInput
      {...props}
      allowFontScaling={false}
      style={[style, { fontSize: baseFontSize * scale }]}
    />
  );
};
