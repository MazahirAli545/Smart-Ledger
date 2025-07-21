/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import Navigation from './Navigation';
import { CustomerProvider } from './src/context/CustomerContext';
import { SupplierProvider } from './src/context/SupplierContext';

export default function App() {
  return (
    <SupplierProvider>
      <CustomerProvider>
        <Navigation />
      </CustomerProvider>
    </SupplierProvider>
  );
}
