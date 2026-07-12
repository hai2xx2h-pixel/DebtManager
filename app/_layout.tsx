import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getPeople } from '../storage/db';
import { rescheduleAllReminders, requestNotificationPermission } from '../storage/notifications';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        const people = await getPeople();
        await rescheduleAllReminders(people);
      }
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // 📱 ĐIỀU HƯỚNG BOTTOM NAVIGATION PHONG CÁCH GLASSMORPHISM
        tabBarStyle: {
          backgroundColor: 'rgba(13, 17, 23, 0.85)', // Độ trong suốt hiệu ứng kính mờ
          position: 'absolute',                       // Bắt buộc để menu nổi lên trên background gradient
          bottom: 0,
          left: 0,
          right: 0,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          elevation: 0,                               // Tắt bóng mặc định thô cứng trên Android
        },
        // ✨ HIỆU ỨNG NEON ACTIVE INDICATOR
        tabBarActiveTintColor: '#00e676',            // Màu Neon Xanh rực rỡ khi được chọn
        tabBarInactiveTintColor: '#475569',          // Màu xám dịu khi chưa kích hoạt
        tabBarLabelStyle: { 
          fontSize: 11, 
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Danh sách',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarLabel: 'Thống kê',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="bar-chart" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminder"
        options={{
          tabBarLabel: 'Nhắc nhở',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" size={size + 2} color={color} />
          ),
        }}
      />
      
      {/* Ẩn các trang chi tiết hoặc modal không cần xuất hiện ở thanh menu dưới đáy */}
      <Tabs.Screen
        name="detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="modal"
        options={{ href: null }} 
      />
    </Tabs>
  );
}
