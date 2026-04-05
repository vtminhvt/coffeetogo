import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AdminSummaryScreen from '../screens/admin/AdminSummaryScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';

const Tab = createBottomTabNavigator();

export default function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#6F4E37' }}>
      <Tab.Screen name="AdminSummary" component={AdminSummaryScreen} options={{ title: 'Tổng quan', tabBarLabel: 'Tổng quan' }} />
      <Tab.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ title: 'Đơn hàng', tabBarLabel: 'Đơn hàng' }} />
    </Tab.Navigator>
  );
}
