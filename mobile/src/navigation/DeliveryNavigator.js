import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DeliveryDashboardScreen from '../screens/delivery/DeliveryDashboardScreen';

const Stack = createNativeStackNavigator();

export default function DeliveryNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DeliveryDashboard" component={DeliveryDashboardScreen} options={{ title: 'Trang Shipper 🛵' }} />
    </Stack.Navigator>
  );
}
