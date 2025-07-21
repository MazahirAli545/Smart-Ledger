import { NavigatorScreenParams } from '@react-navigation/native';

export type AppStackParamList = {
  Dashboard: undefined;
  Invoice: undefined;
  Receipt: undefined;
  Payment: undefined;
  Purchase: undefined;
  AddFolder: undefined; // Added for Add Folder screen
};

export type RootStackParamList = {
  Auth: undefined;
  App: NavigatorScreenParams<AppStackParamList>;
};
