# Font Size Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app its own in-app font-size control (Small/Medium/Large/Extra Large presets) that is completely independent of the phone's system font-size accessibility setting, fixing the layout-truncation bug the user hit when they increased their phone's system font size.

**Architecture:** A `FontScaleContext` loads/persists a scale factor (via new `getFontScale`/`setFontScale` in `storage.ts`, following the existing `SORT_PREFERENCE` pattern). Two wrapper components, `AppText` and `AppTextInput`, read that scale and multiply each component's own `fontSize` at render time while forcing `allowFontScaling={false}` so the OS-level system font setting is ignored. Every screen swaps its `Text`/`TextInput` import from `'react-native'` to these wrappers — no `StyleSheet` values change. A new `SettingsScreen` exposes the 4 presets, reached via a new ⚙️ header button on the Classes tab.

**Tech Stack:** React Native 0.74 / Expo SDK 51, TypeScript, `@react-native-async-storage/async-storage`, React Context. No test framework is configured in this project (`npx tsc --noEmit` is the project's existing verification convention per `CLAUDE.md`) — verification steps use `tsc` plus manual checks in `npm run web`, matching how this repo already verifies changes.

---

### Task 1: Add font-scale persistence to storage.ts

**Files:**
- Modify: `src/utils/storage.ts:4-12` (STORAGE_KEYS), append new functions after `setSortPreference` (currently ends at `src/utils/storage.ts:144`)

- [ ] **Step 1: Add the storage key**

In `src/utils/storage.ts`, change:

```ts
const STORAGE_KEYS = {
  CLASSES: 'attendance_classes',
  STUDENTS: 'attendance_students',
  ATTENDANCE: 'attendance_records',
  SORT_PREFERENCE: 'attendance_sort_preference',
  REMARKS: 'attendance_remarks',
  HOLIDAYS: 'attendance_holidays',
  CANCELLATIONS: 'attendance_cancellations',
};
```

to:

```ts
const STORAGE_KEYS = {
  CLASSES: 'attendance_classes',
  STUDENTS: 'attendance_students',
  ATTENDANCE: 'attendance_records',
  SORT_PREFERENCE: 'attendance_sort_preference',
  REMARKS: 'attendance_remarks',
  HOLIDAYS: 'attendance_holidays',
  CANCELLATIONS: 'attendance_cancellations',
  FONT_SCALE: 'attendance_font_scale',
};
```

- [ ] **Step 2: Add getFontScale/setFontScale functions**

Immediately after the existing `setSortPreference` function (ends at line 144 with a closing `};`), add:

```ts
export const getFontScale = async (): Promise<number> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FONT_SCALE);
    const parsed = data ? parseFloat(data) : NaN;
    return isNaN(parsed) ? 1.0 : parsed;
  } catch (error) {
    return 1.0;
  }
};

export const setFontScale = async (scale: number): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.FONT_SCALE, scale.toString());
};
```

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: same two pre-existing errors in `src/navigation/AppNavigator.tsx` (unrelated `FC<Props>` issue) and nothing new from `storage.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts
git commit -m "Add font scale persistence to storage"
```

---

### Task 2: Create FontScaleContext

**Files:**
- Create: `src/context/FontScaleContext.tsx`

- [ ] **Step 1: Write the context/provider/hook**

```tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFontScale, setFontScale as persistFontScale } from '../utils/storage';

type FontScaleContextValue = {
  scale: number;
  setScale: (scale: number) => void;
};

const FontScaleContext = createContext<FontScaleContextValue>({
  scale: 1.0,
  setScale: () => {},
});

export const FontScaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [scale, setScaleState] = useState(1.0);

  useEffect(() => {
    getFontScale().then(setScaleState);
  }, []);

  const setScale = (value: number) => {
    setScaleState(value);
    persistFontScale(value);
  };

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
};

export const useFontScale = () => useContext(FontScaleContext);
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no new errors from `FontScaleContext.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/context/FontScaleContext.tsx
git commit -m "Add FontScaleContext for app-controlled font scaling"
```

---

### Task 3: Create AppText and AppTextInput wrapper components

**Files:**
- Create: `src/components/AppText.tsx`
- Create: `src/components/AppTextInput.tsx`

- [ ] **Step 1: Write AppText**

```tsx
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
```

- [ ] **Step 2: Write AppTextInput**

```tsx
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
```

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppText.tsx src/components/AppTextInput.tsx
git commit -m "Add AppText/AppTextInput wrappers for app-controlled font scaling"
```

---

### Task 4: Add Settings route type and SettingsScreen

**Files:**
- Modify: `src/types/index.ts:78-94` (RootStackParamList)
- Create: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/index.ts`

- [ ] **Step 1: Add Settings to RootStackParamList**

In `src/types/index.ts`, change:

```ts
export type RootStackParamList = {
  MainTabs: undefined;
  AddClass: undefined;
  EditClass: { classId: string };
  ClassDetails: { classId: string };
  AddStudent: { classId: string };
  EditStudent: { classId: string; studentId: string };
  BulkAddStudents: { classId: string };
  TakeAttendance: { classId: string; date?: string; studentId?: string };
  AttendanceHistory: { classId: string };
  EditAttendance: { classId: string; date: string };
  ClassStats: { classId: string };
  ClassRemarks: { classId: string };
  StudentAttendance: { classId: string; studentId: string };
  ClassSchedule: { classId: string };
  Holidays: undefined;
};
```

to (added `Settings: undefined;` before the closing brace):

```ts
export type RootStackParamList = {
  MainTabs: undefined;
  AddClass: undefined;
  EditClass: { classId: string };
  ClassDetails: { classId: string };
  AddStudent: { classId: string };
  EditStudent: { classId: string; studentId: string };
  BulkAddStudents: { classId: string };
  TakeAttendance: { classId: string; date?: string; studentId?: string };
  AttendanceHistory: { classId: string };
  EditAttendance: { classId: string; date: string };
  ClassStats: { classId: string };
  ClassRemarks: { classId: string };
  StudentAttendance: { classId: string; studentId: string };
  ClassSchedule: { classId: string };
  Holidays: undefined;
  Settings: undefined;
};
```

- [ ] **Step 2: Write SettingsScreen**

```tsx
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
```

- [ ] **Step 3: Export SettingsScreen from screens/index.ts**

In `src/screens/index.ts`, add this line at the end:

```ts
export { SettingsScreen } from './SettingsScreen';
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/screens/SettingsScreen.tsx src/screens/index.ts
git commit -m "Add SettingsScreen with font size presets"
```

---

### Task 5: Wire Settings into navigation and add gear button

**Files:**
- Modify: `src/navigation/AppNavigator.tsx:4-21` (imports), `src/navigation/AppNavigator.tsx:149-153` (add Stack.Screen after Holidays)
- Modify: `src/screens/ClassesScreen.tsx:1-21` (imports), `src/screens/ClassesScreen.tsx:309-340` (headerRight)

- [ ] **Step 1: Switch AppNavigator's Text import to AppText**

In `src/navigation/AppNavigator.tsx`, change:

```tsx
import { Text } from 'react-native';
```

to:

```tsx
import { Text } from '../components/AppText';
```

- [ ] **Step 2: Import SettingsScreen**

In `src/navigation/AppNavigator.tsx`, change:

```tsx
import {
  ClassesScreen,
  AddEditClassScreen,
  ClassDetailsScreen,
  AddEditStudentScreen,
  BulkAddStudentsScreen,
  TakeAttendanceScreen,
  AttendanceHistoryScreen,
  ClassStatsScreen,
  StatisticsScreen,
  ClassRemarksScreen,
  StudentAttendanceScreen,
  ClassScheduleScreen,
  HolidaysScreen,
} from '../screens';
```

to:

```tsx
import {
  ClassesScreen,
  AddEditClassScreen,
  ClassDetailsScreen,
  AddEditStudentScreen,
  BulkAddStudentsScreen,
  TakeAttendanceScreen,
  AttendanceHistoryScreen,
  ClassStatsScreen,
  StatisticsScreen,
  ClassRemarksScreen,
  StudentAttendanceScreen,
  ClassScheduleScreen,
  HolidaysScreen,
  SettingsScreen,
} from '../screens';
```

- [ ] **Step 3: Add the Settings route**

In `src/navigation/AppNavigator.tsx`, immediately after the `Holidays` `Stack.Screen` entry:

```tsx
        <Stack.Screen
          name="Holidays"
          component={HolidaysScreen}
          options={{ title: 'Global Holidays' }}
        />
```

add:

```tsx
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
```

- [ ] **Step 4: Switch ClassesScreen's Text import to AppText**

In `src/screens/ClassesScreen.tsx`, change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  InteractionManager,
  Modal,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  InteractionManager,
  Modal,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 5: Add the gear button to the header**

In `src/screens/ClassesScreen.tsx`, change:

```tsx
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Holidays')}
          >
            <Text style={styles.headerButtonText}>🗓️</Text>
          </TouchableOpacity>
```

to:

```tsx
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.headerButtonText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Holidays')}
          >
            <Text style={styles.headerButtonText}>🗓️</Text>
          </TouchableOpacity>
```

(the rest of the `headerButtons` block — Import/Export buttons — is unchanged)

- [ ] **Step 6: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/navigation/AppNavigator.tsx src/screens/ClassesScreen.tsx
git commit -m "Wire Settings screen into navigation with header gear button"
```

---

### Task 6: Wrap the app in FontScaleProvider

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add the provider**

Replace the full contents of `App.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "Wrap app in FontScaleProvider"
```

---

### Task 7: Switch remaining screens and ConfirmDialog to AppText/AppTextInput

**Files:**
- Modify: `src/components/ConfirmDialog.tsx:1-8`
- Modify: `src/screens/AddEditClassScreen.tsx` (imports)
- Modify: `src/screens/AddEditStudentScreen.tsx` (imports)
- Modify: `src/screens/AttendanceHistoryScreen.tsx` (imports)
- Modify: `src/screens/BulkAddStudentsScreen.tsx` (imports)
- Modify: `src/screens/ClassDetailsScreen.tsx` (imports)
- Modify: `src/screens/ClassRemarksScreen.tsx` (imports)
- Modify: `src/screens/ClassScheduleScreen.tsx` (imports)
- Modify: `src/screens/ClassStatsScreen.tsx` (imports)
- Modify: `src/screens/HolidaysScreen.tsx` (imports)
- Modify: `src/screens/StatisticsScreen.tsx` (imports)
- Modify: `src/screens/StudentAttendanceScreen.tsx` (imports)
- Modify: `src/screens/TakeAttendanceScreen.tsx` (imports)

Every file below gets the same mechanical treatment: remove `Text` (and `TextInput` where present) from the `'react-native'` import block, then add the corresponding wrapper import(s) directly after that block.

- [ ] **Step 1: ConfirmDialog.tsx**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Text } from './AppText';
```

- [ ] **Step 2: AddEditClassScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 3: AddEditStudentScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 4: AttendanceHistoryScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 5: BulkAddStudentsScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 6: ClassDetailsScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 7: ClassRemarksScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 8: ClassScheduleScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 9: ClassStatsScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 10: HolidaysScreen.tsx (Text + TextInput)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  Switch,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
```

- [ ] **Step 11: StatisticsScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 12: StudentAttendanceScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 13: TakeAttendanceScreen.tsx (Text only)**

Change:

```tsx
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
```

to:

```tsx
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Text } from '../components/AppText';
```

- [ ] **Step 14: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: the same two pre-existing errors in `AppNavigator.tsx` (unrelated to this feature) and nothing new. If any file reports `'Text' is declared but never used` or similar, double check that file's JSX still uses the imported name `Text`/`TextInput` (it will — only the import source changed).

- [ ] **Step 15: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/screens/AddEditClassScreen.tsx src/screens/AddEditStudentScreen.tsx src/screens/AttendanceHistoryScreen.tsx src/screens/BulkAddStudentsScreen.tsx src/screens/ClassDetailsScreen.tsx src/screens/ClassRemarksScreen.tsx src/screens/ClassScheduleScreen.tsx src/screens/ClassStatsScreen.tsx src/screens/HolidaysScreen.tsx src/screens/StatisticsScreen.tsx src/screens/StudentAttendanceScreen.tsx src/screens/TakeAttendanceScreen.tsx
git commit -m "Switch remaining screens to AppText/AppTextInput for app-controlled font scaling"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the web dev server**

Run: `npm run web`

- [ ] **Step 2: Verify Settings screen and presets**

In the browser: open the Classes tab, tap the new ⚙️ icon in the header, confirm the Settings screen shows Small/Medium/Large/Extra Large with one highlighted (Medium by default). Tap each preset and confirm all visible text on the Settings screen itself resizes.

- [ ] **Step 3: Verify scaling propagates across screens**

Navigate to a class's details screen (list-heavy) and to Add/Edit Student (form-heavy). Confirm text size matches the preset chosen in Settings on both screens.

- [ ] **Step 4: Verify persistence**

Pick "Large", reload the browser tab (or restart `npm run web`). Confirm the app comes back up already showing Large-sized text (i.e. the preference persisted via AsyncStorage/localStorage web shim).

- [ ] **Step 5: Verify system font scaling is ignored (Android)**

If testing on an Android device/emulator: set the device's system font size to maximum in Android Settings > Display > Font size, relaunch the app, and confirm app text size is unaffected by the device setting (it should only reflect whatever preset is chosen in the app's own Settings screen). This directly confirms the fix for the original bug (truncated "..." button labels).

No commit for this task — it's verification only.
