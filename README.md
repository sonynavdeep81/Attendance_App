# Student Attendance App

A React Native (Expo) app for managing student attendance on Android.

## Features

- ✅ **Class Management**: Create, edit, and delete classes
- ✅ **Student Management**: Add, edit, and delete students within classes
- ✅ **Attendance Marking**:
  - Single-tap to mark students absent
  - Students are present by default
  - Date-wise attendance tracking
  - Bulk mark all present/absent
- ✅ **Attendance History**: View and edit past attendance records
- ✅ **Statistics**:
  - Per-student attendance stats (Total Present, Total Absent, Total Classes)
  - Attendance percentage calculation
  - **Detention Detection**: Highlights students with less than 75% attendance
- ✅ **Data Persistence**: All data stored locally on device using AsyncStorage

## How to Use

### Managing Classes

1. Open the app - you'll see the "My Classes" screen
2. Tap the **+** button to add a new class
3. Long-press on a class to edit or delete it
4. Tap on a class to see its details

### Managing Students

1. Open a class by tapping on it
2. Tap the **+** button to add students
3. Long-press on a student to edit or delete

### Taking Attendance

1. Open a class and tap **"📋 Take Attendance"**
2. All students are marked **Present** by default (green)
3. **Single tap** on any student to mark them **Absent** (turns red)
4. Tap again to mark them back as Present
5. Use "Mark All Present" or "Mark All Absent" for bulk actions
6. Tap **"Save Attendance"** when done

### Viewing Statistics

1. Go to the **Statistics** tab at the bottom
2. See overall stats and class-wise breakdown
3. Tap on any class to see individual student stats
4. Students with **less than 75% attendance** are marked as **DETAINED**
5. Use the filter to show only detained students

### Editing Past Attendance

1. Open a class and tap **"📅 History"**
2. Tap on any date to view/edit that day's attendance
3. Long-press to delete a record

## Installation on Android Phone

### Option 1: Using Expo Go (Easiest - For Testing)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npx expo start
   ```

3. Install **Expo Go** app from Google Play Store on your phone

4. Scan the QR code shown in the terminal with Expo Go

### Option 2: Build APK (For Permanent Installation)

1. Install EAS CLI globally:

   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo (create free account at expo.dev):

   ```bash
   eas login
   ```

3. Configure the project:

   ```bash
   eas build:configure
   ```

4. Build the APK:

   ```bash
   eas build -p android --profile preview
   ```

5. Once build completes, download the APK from the link provided

6. Transfer APK to your phone and install it (enable "Install from unknown sources" in settings)

### Option 3: Local APK Build (No Expo Account Needed)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build locally (requires Android SDK):

   ```bash
   npx expo prebuild
   cd android
   ./gradlew assembleRelease
   ```

3. Find APK at: `android/app/build/outputs/apk/release/app-release.apk`

## Project Structure

```
├── App.tsx                 # Main app entry point
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Storage utilities
│   ├── screens/            # All app screens
│   └── navigation/         # Navigation configuration
├── package.json            # Dependencies
├── app.json               # Expo configuration
└── eas.json               # EAS Build configuration
```

## Data Storage

All data is stored locally on your device using AsyncStorage:

- Classes
- Students
- Attendance records

Data persists even when you close the app. To backup your data, you can export it from the app settings (future feature).

## Detention Rules

A student is marked as **DETAINED** if their attendance percentage falls below **75%**.

Formula: `Attendance % = (Total Present / Total Classes) × 100`

## Tips

- **Quick Attendance**: By default, all students are present. Just tap on absent students!
- **Long Press**: Long-press on any item (class, student, attendance record) for more options
- **Pull to Refresh**: Pull down on any list to refresh data
