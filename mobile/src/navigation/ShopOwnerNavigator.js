import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ShopOwnerOrdersScreen from '../screens/shop_owner/ShopOwnerOrdersScreen';
import ShopOwnerMenuScreen from '../screens/shop_owner/ShopOwnerMenuScreen';
import ShopOwnerCommissionsScreen from '../screens/shop_owner/ShopOwnerCommissionsScreen';

const Tab = createBottomTabNavigator();

export default function ShopOwnerNavigator() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#6F4E37' }}>
      <Tab.Screen name="SOOrders" component={ShopOwnerOrdersScreen} options={{ title: 'Đơn hàng', tabBarLabel: 'Đơn hàng' }} />
      <Tab.Screen name="SOMenu" component={ShopOwnerMenuScreen} options={{ title: 'Menu', tabBarLabel: 'Menu' }} />
      <Tab.Screen name="SOCommissions" component={ShopOwnerCommissionsScreen} options={{ title: 'Hoa hồng', tabBarLabel: 'Hoa hồng' }} />
    </Tab.Navigator>
  );
}
