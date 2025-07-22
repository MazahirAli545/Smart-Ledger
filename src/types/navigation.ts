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
};

export type RootStackParamList = {
  Auth: undefined;
  App: NavigatorScreenParams<AppStackParamList>;
};
