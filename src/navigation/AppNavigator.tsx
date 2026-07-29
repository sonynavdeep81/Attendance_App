import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from '../components/AppText';
import { RootStackParamList, MainTabParamList } from '../types';
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#4A90D9',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Classes"
        component={ClassesScreen}
        options={{
          title: 'My Classes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>📚</Text>,
        }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          title: 'Statistics',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>📊</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4A90D9',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddClass"
          component={AddEditClassScreen}
          options={{ title: 'Add Class' }}
        />
        <Stack.Screen
          name="EditClass"
          component={AddEditClassScreen}
          options={{ title: 'Edit Class' }}
        />
        <Stack.Screen
          name="ClassDetails"
          component={ClassDetailsScreen}
          options={{ title: 'Class Details' }}
        />
        <Stack.Screen
          name="AddStudent"
          component={AddEditStudentScreen}
          options={{ title: 'Add Student' }}
        />
        <Stack.Screen
          name="EditStudent"
          component={AddEditStudentScreen}
          options={{ title: 'Edit Student' }}
        />
        <Stack.Screen
          name="BulkAddStudents"
          component={BulkAddStudentsScreen}
          options={{ title: 'Bulk Add Students' }}
        />
        <Stack.Screen
          name="TakeAttendance"
          component={TakeAttendanceScreen}
          options={{ title: 'Take Attendance' }}
        />
        <Stack.Screen
          name="AttendanceHistory"
          component={AttendanceHistoryScreen}
          options={{ title: 'Attendance History' }}
        />
        <Stack.Screen
          name="ClassStats"
          component={ClassStatsScreen}
          options={{ title: 'Class Statistics' }}
        />
        <Stack.Screen
          name="ClassRemarks"
          component={ClassRemarksScreen}
          options={{ title: 'Remarks' }}
        />
        <Stack.Screen
          name="StudentAttendance"
          component={StudentAttendanceScreen}
          options={{ title: 'Student Attendance' }}
        />
        <Stack.Screen
          name="ClassSchedule"
          component={ClassScheduleScreen}
          options={{ title: 'Class Schedule' }}
        />
        <Stack.Screen
          name="Holidays"
          component={HolidaysScreen}
          options={{ title: 'Global Holidays' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
