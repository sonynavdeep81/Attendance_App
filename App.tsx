import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { FontScaleProvider } from './src/context/FontScaleContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <FontScaleProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </FontScaleProvider>
    </SafeAreaProvider>
  );
}
