import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ShopListScreen from '../screens/customer/ShopListScreen';
import ShopDetailScreen from '../screens/customer/ShopDetailScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';

const Tab = createBottomTabNavigator();
const ShopsStack = createNativeStackNavigator();

function ShopsStackNavigator() {
  return (
    <ShopsStack.Navigator>
      <ShopsStack.Screen name="ShopList" component={ShopListScreen} options={{ title: 'Quán cà phê' }} />
      <ShopsStack.Screen name="ShopDetail" component={ShopDetailScreen} options={{ title: 'Chi tiết quán' }} />
    </ShopsStack.Navigator>
  );
}

export default function CustomerNavigator() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#6F4E37' }}>
      <Tab.Screen name="Shops" component={ShopsStackNavigator} options={{ headerShown: false, tabBarLabel: 'Đặt hàng' }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Đơn của tôi', tabBarLabel: 'Đơn hàng' }} />
    </Tab.Navigator>
  );
}
