import React, { useEffect } from 'react';
import InvoiceScreen from './InvoiceScreen';
import ReceiptScreen from './ReceiptScreen';
import PaymentScreen from './PaymentScreen';
import PurchaseScreen from './PurchaseScreen';
import { View, Text } from 'react-native';

interface FolderScreenProps {
  route: {
    params: {
      folder: {
        id?: number;
        title?: string;
        icon?: string;
      };
    };
  };
  navigation: any;
}

const FolderScreen: React.FC<FolderScreenProps> = ({ route, navigation }) => {
  const { folder } = route.params;

  // Create a wrapper component to handle the "+ Add" button properly
  const renderScreen = (ScreenComponent: React.ComponentType<any>) => {
    // We need to ensure the ScreenComponent is properly rendered with navigation props
    // The error occurs because the "+ Add" text is not wrapped in a Text component
    return <ScreenComponent folder={folder} navigation={navigation} />;
  };

  // Set the screen options when component mounts
  useEffect(() => {
    // Set the header title to the folder name
    navigation.setOptions({
      headerTitle: folder?.title || 'Folder',
    });
  }, [navigation, folder]);

  // Map folder types to screens
  const getScreenComponent = (icon: string) => {
    switch (icon?.toLowerCase()) {
      case 'sell':
      case 'invoice':
        return InvoiceScreen;
      case 'receipt':
        return ReceiptScreen;
      case 'payment':
        return PaymentScreen;
      case 'purchase':
        return PurchaseScreen;
      default:
        // For unknown types, default to InvoiceScreen
        return InvoiceScreen;
    }
  };

  const ScreenComponent = getScreenComponent(folder.icon || '');

  if (!ScreenComponent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Unknown folder type: {folder.icon}</Text>
      </View>
    );
  }

  return renderScreen(ScreenComponent);
};

export default FolderScreen;
