import { Alert, Platform } from 'react-native';

// Alert.alert() với nhiều nút (Hủy/Xóa) không hoạt động trên bản Web
// (react-native-web không hỗ trợ popup nhiều nút tùy chỉnh).
// Hàm này tự chuyển sang window.confirm() khi chạy trên web,
// và dùng Alert.alert() bình thường khi chạy trên app thật (iOS/Android).
export const confirmAction = (title, message, onConfirm, confirmText = 'Xóa', destructive = true) => {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Hủy', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};
