import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../components/AppText';
import { useFontScale } from '../context/FontScaleContext';

const PRESETS = [
  { label: 'Small', value: 0.85 },
  { label: 'Medium', value: 1.0 },
  { label: 'Large', value: 1.15 },
  { label: 'Extra Large', value: 1.3 },
];

export const SettingsScreen: React.FC = () => {
  const { scale, setScale } = useFontScale();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Font Size</Text>
      <Text style={styles.sectionSubtitle}>
        Controls text size inside the app only — your phone's system font size setting is ignored.
      </Text>
      {PRESETS.map((preset) => {
        const active = Math.abs(preset.value - scale) < 0.001;
        return (
          <TouchableOpacity
            key={preset.label}
            style={[styles.presetButton, active && styles.presetButtonActive]}
            onPress={() => setScale(preset.value)}
          >
            <Text style={[styles.presetText, active && styles.presetTextActive]}>
              {preset.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  presetButtonActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#eaf2fb',
  },
  presetText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#4A90D9',
  },
});
