import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CustomerNavigator from './CustomerNavigator';
import ShopOwnerNavigator from './ShopOwnerNavigator';
import DeliveryNavigator from './DeliveryNavigator';
import AdminNavigator from './AdminNavigator';

const Root = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6F4E37" />
    </View>
  );
}

function RoleNavigator({ role }) {
  switch (role) {
    case 'customer':    return <CustomerNavigator />;
    case 'shop_owner':  return <ShopOwnerNavigator />;
    case 'delivery':    return <DeliveryNavigator />;
    case 'admin':       return <AdminNavigator />;
    default:            return null;
  }
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Root.Screen name="App">
            {() => <RoleNavigator role={user.role} />}
          </Root.Screen>
        ) : (
          <>
            <Root.Screen name="Login" component={LoginScreen} />
            <Root.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
