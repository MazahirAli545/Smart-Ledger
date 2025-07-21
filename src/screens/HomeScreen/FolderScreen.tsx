import React from 'react';
import InvoiceScreen from './InvoiceScreen';
import ReceiptScreen from './ReceiptScreen';
import PaymentScreen from './PaymentScreen';
import PurchaseScreen from './PurchaseScreen';
import { View, Text } from 'react-native';

const FolderScreen = ({ route }) => {
  const { folder } = route.params;

  switch (folder.icon) {
    case 'invoice':
      return <InvoiceScreen folder={folder} />;
    case 'receipt':
      return <ReceiptScreen folder={folder} />;
    case 'payment':
      return <PaymentScreen folder={folder} />;
    case 'purchase':
      return <PurchaseScreen folder={folder} />;
    default:
      return (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text>Unknown folder type.</Text>
        </View>
      );
  }
};

export default FolderScreen;
