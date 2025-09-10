import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../api';
import { useAlert } from '../../context/AlertContext';

const FOLDER_TYPE_ICONS: Record<string, string> = {
  purchase: 'cart-outline',
  groceries: 'cart-outline',
  receipt: 'receipt',
  payment: 'currency-inr',
  invoice: 'file-document-outline',
  sell: 'cart-plus',
};
const getFolderIcon = (icon: string | undefined, title?: string) => {
  if (!icon) {
    // Fallback to title-based icon mapping
    if (title) {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle === 'sell') return 'cart-plus';
      if (lowerTitle === 'receipt') return 'receipt';
      if (lowerTitle === 'payment') return 'currency-inr';
      if (lowerTitle === 'purchase') return 'cart-outline';
      if (lowerTitle === 'add folder') return 'folder-plus';

      // For custom folders, try to determine appropriate icon based on name
      if (lowerTitle.includes('gst') || lowerTitle.includes('tax'))
        return 'calculator';
      if (lowerTitle.includes('cash') || lowerTitle.includes('money'))
        return 'cash-multiple';
      if (lowerTitle.includes('bank') || lowerTitle.includes('account'))
        return 'bank';
      if (lowerTitle.includes('expense') || lowerTitle.includes('cost'))
        return 'cash-minus';
      if (lowerTitle.includes('income') || lowerTitle.includes('revenue'))
        return 'cash-plus';
      if (lowerTitle.includes('report') || lowerTitle.includes('analytics'))
        return 'chart-line';
      if (lowerTitle.includes('customer') || lowerTitle.includes('client'))
        return 'account-group';
      if (lowerTitle.includes('supplier') || lowerTitle.includes('vendor'))
        return 'truck-delivery';
      if (lowerTitle.includes('product') || lowerTitle.includes('item'))
        return 'package-variant';
      if (lowerTitle.includes('service') || lowerTitle.includes('work'))
        return 'briefcase';

      // For very short or random names, use a generic folder icon
      if (lowerTitle.length <= 5) return 'folder-multiple';

      // Default for custom folders
      return 'folder-multiple';
    }
    return 'folder-outline';
  }

  const mapped = FOLDER_TYPE_ICONS[String(icon).toLowerCase()];
  return mapped || icon || 'folder-outline';
};

const AllQuickActionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { showAlert } = useAlert();
  const actions = (route.params as any)?.actions || [];

  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [folderToDelete, setFolderToDelete] = React.useState<any>(null);
  const showDeleteModal = (folder: any) => {
    setFolderToDelete(folder);
    setDeleteModalVisible(true);
  };
  const hideDeleteModal = () => {
    setDeleteModalVisible(false);
    setFolderToDelete(null);
  };
  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    await handleDeleteFolder(folderToDelete.id);
    hideDeleteModal();
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      await axios.delete(`${BASE_URL}/menus/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigation.goBack(); // After delete, go back to Dashboard (which will refresh)
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to delete folder.',
        type: 'error',
        confirmText: 'OK',
      });
    }
  };

  const handleActionPress = (action: any) => {
    // Navigate to the appropriate screen based on action type
    const actionType =
      action.type?.toLowerCase() || action.title?.toLowerCase();

    // Map action types to screen names (matching Navigation.tsx screen names)
    const screenMapping: Record<string, string> = {
      purchase: 'Purchase',
      invoice: 'Invoice',
      receipt: 'Receipt',
      payment: 'Payment',
      groceries: 'Purchase', // Assuming groceries uses purchase screen
      folder: 'FolderScreen',
      profile: 'ProfileScreen',
      'add folder': 'AddFolder',
      dashboard: 'Dashboard',
    };

    // Try to find a matching screen name
    let targetScreen = screenMapping[actionType];

    // If no direct mapping, try to match by title
    if (!targetScreen && action.title) {
      const cleanTitle = action.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      targetScreen = screenMapping[cleanTitle];
    }

    // If still no match, try to match partial words
    if (!targetScreen && action.title) {
      const title = action.title.toLowerCase();
      if (title.includes('invoice')) targetScreen = 'Invoice';
      else if (title.includes('receipt')) targetScreen = 'Receipt';
      else if (title.includes('payment')) targetScreen = 'Payment';
      else if (title.includes('purchase')) targetScreen = 'Purchase';
      else if (title.includes('folder')) targetScreen = 'FolderScreen';
      else if (title.includes('profile')) targetScreen = 'ProfileScreen';
    }

    // If still no match, check if it's a dynamic folder (has route property)
    if (!targetScreen && action.route) {
      targetScreen = 'FolderScreen';
    }

    // If still no match, show an alert
    if (!targetScreen) {
      showAlert({
        title: 'Navigation Error',
        message: `Screen for "${action.title}" is not available. This might be a test action or an action that needs to be configured.`,
        type: 'warning',
        confirmText: 'OK',
      });
      return;
    }

    // Navigate to the target screen
    try {
      if (targetScreen === 'FolderScreen' && action.route) {
        // For dynamic folders, pass the action as folder parameter
        (navigation as any).navigate(targetScreen, { folder: action });
      } else {
        (navigation as any).navigate(targetScreen);
      }
    } catch (error) {
      console.log(`Navigation error: ${error}`);
      showAlert({
        title: 'Error',
        message: `Unable to navigate to ${action.title}`,
        type: 'error',
        confirmText: 'OK',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>All Quick Actions</Text>
      </View>
      <FlatList
        data={actions}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: 0, marginBottom: 0 },
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              position: 'relative',
              width: '48%',
              height: 100,
              marginBottom: 16,
              backgroundColor: '#fff',
              borderRadius: 8,
            }}
            onPress={() => handleActionPress(item)}
            activeOpacity={0.7}
          >
            {/* Centered content */}
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                height: '100%',
                paddingVertical: 10,
              }}
            >
              <MaterialCommunityIcons
                name={getFolderIcon(item.icon, item.title)}
                size={28}
                color="#222"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.actionText}>{item.title}</Text>
            </View>
            {/* Delete button */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 2,
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 2,
                elevation: 2,
              }}
              onPress={e => {
                e.stopPropagation(); // Prevent triggering the parent onPress
                showDeleteModal(item);
              }}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={18}
                color="#dc3545"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      {/* Custom Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={hideDeleteModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.18)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 28,
              width: 320,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={44}
              color="#dc3545"
              style={{ marginBottom: 10 }}
            />
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#222',
                marginBottom: 10,
              }}
            >
              Delete Folder
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#444',
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Are you sure you want to delete the folder
              <Text style={{ fontWeight: 'bold', color: '#dc3545' }}>
                {' '}
                "{folderToDelete?.title}"
              </Text>
              ?{'\n'}This action cannot be undone.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                gap: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#bbb',
                  backgroundColor: '#fff',
                  marginRight: 0,
                }}
                onPress={hideDeleteModal}
              >
                <Text
                  style={{ color: '#444', fontWeight: 'bold', fontSize: 16 }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  backgroundColor: '#dc3545',
                }}
                onPress={confirmDeleteFolder}
              >
                <Text
                  style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { marginRight: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  grid: { padding: 16 },
  actionButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  actionText: { fontSize: 14, color: '#222', marginTop: 8, fontWeight: '500' },
});

export default AllQuickActionsScreen;
