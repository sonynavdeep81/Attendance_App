import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';

export const Text: React.FC<TextProps> = ({ style, ...props }) => {
  const { scale } = useFontScale();
  const flat = StyleSheet.flatten(style) || {};
  const baseFontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 14;

  return (
    <RNText
      {...props}
      allowFontScaling={false}
      style={[style, { fontSize: baseFontSize * scale }]}
    />
  );
};
