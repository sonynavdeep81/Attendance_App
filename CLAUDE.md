# Student Attendance App

React Native + Expo app for student attendance tracking. Teachers manage classes, take attendance, view stats, export to Excel.

## Tech Stack
- React Native 0.74.5, Expo SDK ~51.0.0, TypeScript ^5.1.3
- Navigation: `@react-navigation/native` (native-stack, bottom-tabs)
- Storage: `@react-native-async-storage/async-storage`
- Export: `expo-file-system`, `expo-sharing`
- Platforms: Android (local Gradle build), Web (react-native-web)

## Architecture
- `src/utils/storage.ts` — All CRUD, stats, and export logic
- `src/screens/` — UI screens consuming storage functions
- `src/types/index.ts` — TypeScript interfaces
- `App.tsx` — Tab + stack navigation

## Key Rules
- **Detained**: attendance < 75%. No records = 100% (not detained)
- **Storage**: only absent IDs stored; present = not in `absentStudentIds`
- **Hooks**: always `useCallback` for handlers referencing state; `useFocusEffect` to reload on focus
- **Export**: single class = HTML table `.xls`; multi-sheet = Excel XML `.xls`; platform check required (web: Blob download, mobile: FileSystem + Sharing)

## Commands
```bash
npm start              # Expo dev server
npm run web            # Browser
npx tsc --noEmit       # TypeScript check — run after every change
```

## Building the APK
Always use the local Gradle build. Do NOT use EAS cloud build or Expo Go.

```bash
# 1. Bundle JS assets
npx expo export --platform android

# 2. Build release APK with Gradle
cd android && ./gradlew assembleRelease

# 3. Copy APK to project root
cp android/app/build/outputs/apk/release/app-release.apk StudentAttendance.apk
```
Output APK: `StudentAttendance.apk` in project root.
