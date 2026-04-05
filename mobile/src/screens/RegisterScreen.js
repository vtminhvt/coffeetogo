import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../contexts/AuthContext';

const ROLES = [
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Chủ quán', value: 'shop_owner' },
  { label: 'Shipper', value: 'delivery' },
];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) {
      Alert.alert('Lỗi', 'Vui lòng điền đủ họ tên, email và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      Alert.alert('Đăng ký thất bại', err.response?.data?.error || 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>☕ CoffeeToGo</Text>
      <Text style={styles.subtitle}>Tạo tài khoản mới</Text>

      <TextInput style={styles.input} placeholder="Họ và tên *" value={form.name} onChangeText={v => set('name', v)} />
      <TextInput style={styles.input} placeholder="Email *" value={form.email} onChangeText={v => set('email', v)}
        keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Số điện thoại" value={form.phone} onChangeText={v => set('phone', v)}
        keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Mật khẩu *" value={form.password} onChangeText={v => set('password', v)}
        secureTextEntry />

      <Text style={styles.label}>Vai trò</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={form.role} onValueChange={v => set('role', v)}>
          {ROLES.map(r => <Picker.Item key={r.value} label={r.label} value={r.value} />)}
        </Picker>
      </View>

      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Đang đăng ký...' : 'Đăng ký'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Đã có tài khoản? <Text style={styles.linkBold}>Đăng nhập</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#6F4E37', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 16 },
  label: { color: '#555', marginBottom: 4, fontWeight: '500' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 14 },
  btn: { backgroundColor: '#6F4E37', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#888', fontSize: 14 },
  linkBold: { color: '#6F4E37', fontWeight: '600' },
});
