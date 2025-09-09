/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import Navigation from './Navigation';
import { CustomerProvider } from './src/context/CustomerContext';
import { SupplierProvider } from './src/context/SupplierContext';
import { VoucherProvider } from './src/context/VoucherContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { SubscriptionNotificationProvider } from './src/context/SubscriptionNotificationContext';
import { PlanExpiryProvider } from './src/context/PlanExpiryContext';
import { AlertProvider } from './src/context/AlertContext';
import CustomAlert from './src/components/CustomAlert';
// import { NetworkProvider } from './src/context/NetworkContext';

import {
  logNetworkDebugInfo,
  testApiConnectivity,
} from './src/utils/networkDebug';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Debug network configuration on app start
    const debugNetwork = async () => {
      console.log('🚀 App starting - debugging network configuration...');
      await logNetworkDebugInfo();
      await testApiConnectivity();
    };

    debugNetwork();
  }, []);

  return (
    <AlertProvider>
      <NotificationProvider>
        <SubscriptionNotificationProvider>
          <PlanExpiryProvider>
            <SubscriptionProvider>
              <VoucherProvider>
                <SupplierProvider>
                  <CustomerProvider>
                    <Navigation />
                    <CustomAlert />
                  </CustomerProvider>
                </SupplierProvider>
              </VoucherProvider>
            </SubscriptionProvider>
          </PlanExpiryProvider>
        </SubscriptionNotificationProvider>
      </NotificationProvider>
    </AlertProvider>
  );
}
