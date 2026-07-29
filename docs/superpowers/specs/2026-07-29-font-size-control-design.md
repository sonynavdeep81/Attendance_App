# Font Size Control — Design

## Problem

The user increased their phone's system font size (Android accessibility
setting). Because the app's `Text` components have the RN default
`allowFontScaling={true}`, all text grew to match — but the app's
fixed-size buttons and layouts don't adapt, so button labels truncate
(e.g. "▶️ Take Attendance" rendering as "..."). See screenshot: header
stats, action buttons, and list rows all show clipped/overlapping text
at large system font sizes.

## Goal

Give the app its own font-size control, independent of the phone's
system setting, so:
- The app never breaks layout due to a phone-level accessibility setting
  the user doesn't control from within the app.
- The user can still make text bigger/smaller if they want, via an
  in-app setting.

## Approach

Disable system font scaling (`allowFontScaling={false}`) on every
text-rendering component, and replace it with an app-controlled scale
factor applied at render time via wrapper components. Presets only —
Small (0.85), Medium (1.0, default), Large (1.15), Extra Large (1.3) —
multiplied against whatever `fontSize` a screen's `StyleSheet` already
specifies. Existing `fontSize` values in the 12 screens are not
rewritten; the wrapper multiplies them at render time.

**Why not monkey-patch `PixelRatio.getFontScale()`:** would avoid
touching every file, but on Android the native Text renderer reads the
device's font-scale configuration directly rather than through that JS
override, so it doesn't reliably decouple app text from the phone's
system setting. The wrapper-component approach is more files touched but
is the one guaranteed correct.

## Components

**`src/utils/storage.ts`** (existing file)
- Add `FONT_SCALE` to `STORAGE_KEYS`.
- Add `getFontScale(): Promise<number>` (defaults to `1.0` if unset) and
  `setFontScale(scale: number): Promise<void>`, following the same
  pattern as the existing `SORT_PREFERENCE` getter/setter.

**`src/context/FontScaleContext.tsx`** (new)
- `FontScaleProvider`: on mount, loads the persisted scale via
  `getFontScale()`; exposes `{ scale, setScale }` where `setScale`
  updates both React state and persisted storage.
- `useFontScale()` hook for consumers.
- Wraps `<AppNavigator />` in `App.tsx`.

**`src/components/AppText.tsx`** (new)
- Drop-in replacement for RN's `Text`. Flattens the incoming `style`
  prop, multiplies any resolved `fontSize` (default 14 if none set) by
  `scale` from `useFontScale()`, and always passes
  `allowFontScaling={false}` to the underlying `Text`.

**`src/components/AppTextInput.tsx`** (new)
- Same wrapping behavior as `AppText`, for RN's `TextInput`, so form
  fields scale consistently with display text.

**Screen updates (mechanical, 14 files for `Text`, 6 for `TextInput`)**
- In each screen currently doing
  `import { Text, View, ... } from 'react-native'`, remove `Text`
  (and/or `TextInput`) from that destructure and add
  `import { Text } from '../components/AppText'` /
  `import { TextInput } from '../components/AppTextInput'`.
- No changes to any `StyleSheet.create` blocks — the 173 existing
  `fontSize` values stay as-is.
- Files: `ConfirmDialog.tsx`, `AppNavigator.tsx`, and all 12 screens in
  `src/screens/` (see grep results — `AddEditClassScreen`,
  `AddEditStudentScreen`, `AttendanceHistoryScreen`,
  `BulkAddStudentsScreen`, `ClassDetailsScreen`, `ClassesScreen`,
  `ClassRemarksScreen`, `ClassScheduleScreen`, `ClassStatsScreen`,
  `HolidaysScreen`, `StatisticsScreen`, `StudentAttendanceScreen`,
  `TakeAttendanceScreen`).

**`src/screens/SettingsScreen.tsx`** (new)
- Four preset buttons: Small / Medium / Large / Extra Large.
- Active preset highlighted (matches `scale` from `useFontScale()`).
- Tapping a preset calls `setScale(value)` immediately (no save button
  — matches the app's existing "changes apply immediately" feel, e.g.
  sort preference toggle).

**Navigation**
- Add `Settings` to `RootStackParamList` and a `Stack.Screen` entry in
  `AppNavigator.tsx` (title: "Settings").
- Add a ⚙️ header-right button on the `Classes` tab (`ClassesScreen`)
  that navigates to `Settings`.

## Data flow

1. App launch → `FontScaleProvider` loads persisted scale (default 1.0).
2. Any `AppText`/`AppTextInput` instance reads `scale` from context on
   render and multiplies its own `fontSize`.
3. User opens Settings → taps a preset → `setScale()` updates context
   state (triggers re-render of all mounted text) and persists to
   AsyncStorage.
4. Next app launch reloads the persisted preset.

## Error handling

- `getFontScale()` returns `1.0` if storage read fails or key is unset
  (same defensive pattern as other storage getters in `storage.ts`).
- No new error states are introduced; this is a pure presentation
  feature with no data-integrity implications.

## Testing / Verification

- `npx tsc --noEmit` — must not introduce new type errors beyond the
  two pre-existing ones in `AppNavigator.tsx` (unrelated to this
  feature).
- Manual verification via `npm run web` (or Android build):
  1. Open Settings, cycle through all 4 presets, confirm text visibly
     resizes across at least one list-heavy screen (ClassDetails) and
     one form screen (AddEditStudent).
  2. Set phone's system font size to maximum, confirm app text size is
     unaffected (proves `allowFontScaling={false}` is taking effect).
  3. Restart the app after picking "Large", confirm the preference
     persists.
