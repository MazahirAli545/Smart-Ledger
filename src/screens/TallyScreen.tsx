import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useStatusBarWithGradient } from '../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../utils/headerLayout';

const GRADIENT = ['#4f8cff', '#1ecb81'];

const TallyScreen = () => {
  const navigation = useNavigation();
  const { statusBarSpacer } = useStatusBarWithGradient('Tally', GRADIENT);
  const preciseStatusBarHeight = getStatusBarHeight(true);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          getSolidHeaderStyle(preciseStatusBarHeight || statusBarSpacer.height),
        ]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tally</Text>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <SafeAreaView style={styles.body} edges={['bottom']}>
        <View style={styles.card}>
          <Text style={styles.title}>Tally Integration</Text>
          <Text style={styles.subtitle}>
            Tally sync is available for Professional and Enterprise plans.
            Please contact support to enable the integration.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Roboto-Medium',
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
});

export default TallyScreen;
