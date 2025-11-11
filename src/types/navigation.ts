import { NavigatorScreenParams } from '@react-navigation/native';

export type AppStackParamList = {
  Dashboard: undefined;
  Invoice: undefined;
  Receipt: undefined;
  Payment: undefined;
  Purchase: undefined;
  AddFolder: undefined; // Added for Add Folder screen
  FolderScreen: { folder: any };
  ProfileScreen: { user: any };
  Customer:
    | { selectedTab?: 'customer' | 'supplier'; shouldRefresh?: boolean }
    | undefined; // Added for Customer screen
  AddCustomerFromContacts: { shouldRefresh?: boolean } | undefined; // Added for Add Customer from Contacts screen
  AddParty:
    | {
        contactData?: { name: string; phoneNumber: string };
        partyType?: 'customer' | 'supplier';
        editMode?: boolean;
        customerData?: any;
        shouldRefresh?: boolean;
      }
    | undefined; // Added for Add Party screen
  CustomerDetail:
    | { customer: any; partyType: 'customer' | 'supplier'; refresh?: boolean }
    | undefined;
  AddNewEntry: {
    customer: any;
    partyType: 'customer' | 'supplier';
    entryType: 'gave' | 'got';
    editingItem?: any;
    showInvoiceUI?: boolean; // New parameter to show invoice UI when needed
    showPurchaseUI?: boolean; // New parameter to show purchase UI when needed
    shouldRefresh?: boolean; // Tell CustomerDetailScreen to refresh when returning
  };
  AllQuickActionsScreen: { actions: any[] };
  SubscriptionPlan: undefined;
  CashFlow: undefined; // Added for Cash Flow screen
  GSTSummary: undefined; // Added for GST Summary screen
  DailyLedger: undefined; // Added for Daily Ledger screen
  Notifications: undefined; // Added for Notifications screen
  NotificationTest: undefined; // Added for Notification Test screen
  Report: undefined; // Added for Reports screen
  LinkToCA: undefined; // Added for Link to CA screen
};

export type RootStackParamList = {
  Auth: undefined;
  App: NavigatorScreenParams<AppStackParamList>;
};
