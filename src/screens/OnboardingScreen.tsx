import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

// Define navigation prop type
// If you have a RootStackParamList, use it. For now, use 'any' for simplicity.
type OnboardingScreenProps = {
  navigation: StackNavigationProp<any, any>;
};

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80'; // Placeholder

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image
          source={{ uri: HERO_IMAGE }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <Text style={styles.title}>Smart Ledger</Text>
        <Text style={styles.subtitle}>AI Powered Entry System</Text>
        <Text style={styles.description}>
          Simplify your business accounting with smart data entry from PDFs,
          images, and voice. All your records are automatically organized and
          seamlessly connected to your Chartered Accountant.
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.getStartedButton]}
            onPress={() => navigation.navigate('CreateAccount')}
          >
            <Text style={[styles.buttonText, styles.getStartedText]}>
              Create on here
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#007bff',
    fontWeight: '600',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  getStartedButton: {
    backgroundColor: '#28a745',
  },
  getStartedText: {
    color: '#fff',
  },
});

export default OnboardingScreen;
