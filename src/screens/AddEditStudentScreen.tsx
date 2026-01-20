import React, { useState, useEffect } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, updateStudent, getStudentById, getSortPreference, setSortPreference } from '../utils/storage';

type AddStudentProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddStudent'>;
  route: RouteProp<RootStackParamList, 'AddStudent'>;
};

type EditStudentProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EditStudent'>;
  route: RouteProp<RootStackParamList, 'EditStudent'>;
};

type Props = AddStudentProps | EditStudentProps;

export const AddEditStudentScreen: React.FC<Props> = (props) => {
  const { classId } = props.route.params;
  const isEdit = 'studentId' in props.route.params;
  const studentId = isEdit ? (props as EditStudentProps).route.params.studentId : null;

  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortByRoll, setSortByRoll] = useState(false);

  useEffect(() => {
    if (isEdit && studentId) {
      loadStudentData();
    }
    loadSortPreference();
  }, [isEdit, studentId]);

  const loadSortPreference = async () => {
    const pref = await getSortPreference();
    setSortByRoll(pref);
  };

  const handleSortToggle = async (value: boolean) => {
    setSortByRoll(value);
    await setSortPreference(value);
  };

  const loadStudentData = async () => {
    if (!studentId) return;
    const student = await getStudentById(studentId);
    if (student) {
      setName(student.name);
      setRollNumber(student.rollNumber);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter student name');
      return;
    }
    if (!rollNumber.trim()) {
      Alert.alert('Error', 'Please enter roll number');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && studentId) {
        await updateStudent(studentId, name.trim(), rollNumber.trim());
        Alert.alert('Success', 'Student updated successfully');
      } else {
        await addStudent(classId, name.trim(), rollNumber.trim(), sortByRoll);
        Alert.alert('Success', 'Student added successfully');
      }
      props.navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.label}>Roll Number *</Text>
        <TextInput
          style={styles.input}
          value={rollNumber}
          onChangeText={setRollNumber}
          placeholder="e.g., 1 or A001"
          placeholderTextColor="#999"
          autoFocus
        />

        <Text style={styles.label}>Student Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., John Doe"
          placeholderTextColor="#999"
        />

        {!isEdit && (
          <View style={styles.sortOption}>
            <View style={styles.sortOptionText}>
              <Text style={styles.sortLabel}>Sort by Roll Number</Text>
              <Text style={styles.sortHint}>
                {sortByRoll ? 'Students will be arranged by roll number' : 'Students will be appended at the end'}
              </Text>
            </View>
            <Switch
              value={sortByRoll}
              onValueChange={handleSortToggle}
              trackColor={{ false: '#ddd', true: '#81b0ff' }}
              thumbColor={sortByRoll ? '#4A90D9' : '#f4f3f4'}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Add Student'}
          </Text>
        </TouchableOpacity>

        {!isEdit && (
          <Text style={styles.hint}>
            Tip: You can add multiple students quickly by saving and adding more.
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sortOptionText: {
    flex: 1,
    marginRight: 12,
  },
  sortLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sortHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
});
