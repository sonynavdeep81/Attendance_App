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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addClass, updateClass, getClassById } from '../utils/storage';

type AddClassProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddClass'>;
};

type EditClassProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EditClass'>;
  route: RouteProp<RootStackParamList, 'EditClass'>;
};

type Props = AddClassProps | EditClassProps;

export const AddEditClassScreen: React.FC<Props> = (props) => {
  const isEdit = 'route' in props && props.route.params?.classId;
  const classId = isEdit ? (props as EditClassProps).route.params.classId : null;

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && classId) {
      loadClassData();
    }
  }, [isEdit, classId]);

  const loadClassData = async () => {
    if (!classId) return;
    const classData = await getClassById(classId);
    if (classData) {
      setName(classData.name);
      setSubject(classData.subject || '');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a class name');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && classId) {
        await updateClass(classId, name.trim(), subject.trim() || undefined);
        Alert.alert('Success', 'Class updated successfully');
      } else {
        await addClass(name.trim(), subject.trim() || undefined);
        Alert.alert('Success', 'Class added successfully');
      }
      props.navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save class');
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
        <Text style={styles.label}>Class Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., Class 10-A"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Subject (Optional)</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="e.g., Mathematics"
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : isEdit ? 'Update Class' : 'Add Class'}
          </Text>
        </TouchableOpacity>
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
});
