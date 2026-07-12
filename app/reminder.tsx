import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { getPeople } from '../storage/db';
import {
  getNotificationPermissionStatus,
  rescheduleAllReminders,
  requestNotificationPermission
} from '../storage/notifications';

export default function ReminderScreen() {
  const [people, setPeople] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      if (Platform.OS !== 'web') {
        getNotificationPermissionStatus().then(setPermissionStatus);
      }
    }, [])
  );

  const loadData = async () => {
    const data = await getPeople();
    setPeople(data.filter(p => p.balance > 0));
  };

  const handleSyncReminders = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Không hỗ trợ', 'Thông báo đẩy chỉ hoạt động trên app điện thoại, không hoạt động trên bản web.');
      return;
    }
    setSyncing(true);
    try {
      const granted = await requestNotificationPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        Alert.alert(
          'Chưa cấp quyền',
          'Bạn cần bật quyền thông báo cho app trong Cài đặt điện thoại để nhận nhắc nợ tự động.'
        );
        return;
      }
      const data = await getPeople();
      await rescheduleAllReminders(data.filter(p => p.balance > 0 && p.dueDate));
      Alert.alert('Xong', 'Đã đồng bộ lại lịch nhắc nợ cho tất cả các khoản có hẹn ngày trả.');
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể đồng bộ thông báo.');
    } finally {
      setSyncing(false);
    }
  };

  const showOptions = (person) => {
    Alert.alert(
      `${person.name}`,
      `Nợ: ${person.balance.toLocaleString('vi-VN')} đ\n${person.phone ? 'SĐT: ' + person.phone : 'Chưa có số điện thoại'}\nHẹn trả: ${person.dueDate || 'Chưa hẹn'}`,
      [
        person.phone ? {
          text: '📞 Gọi ngay',
          onPress: () => Linking.openURL(`tel:${person.phone}`)
        } : null,
        person.phone ? {
          text: '💬 Nhắn tin',
          onPress: () => Linking.openURL(`sms:${person.phone}`)
        } : null,
        { text: 'Đóng', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Quá hạn': return '#ff4d4d';
      case 'Sắp đến hạn': return '#ffaa00';
      case 'Đúng hạn': return '#00e676';
      default: return '#64748b';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhắc nhở</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>📞 Bấm vào tên để gọi hoặc nhắn tin nhắc nợ</Text>
      </View>

      {Platform.OS !== 'web' && (
        <View style={styles.notifyBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifyTitle}>🔔 Thông báo nhắc nợ tự động</Text>
            <Text style={styles.notifySub}>
              {permissionStatus === 'granted'
                ? 'Đang bật - tự nhắc trước 1 ngày và đúng ngày hẹn trả'
                : 'Chưa bật - bấm nút để cho phép và đồng bộ'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, permissionStatus === 'granted' && styles.syncBtnActive]}
            onPress={handleSyncReminders}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncBtnTxt}>{permissionStatus === 'granted' ? 'Đồng bộ lại' : 'Bật ngay'}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={people}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const color = getStatusColor(item.status);
          return (
            <TouchableOpacity
              style={styles.personCard}
              onPress={() => showOptions(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.leftIndicator, { backgroundColor: color }]} />
              <View style={[styles.avatar, { borderColor: color, backgroundColor: color + '20' }]}>
                <Text style={{ color, fontWeight: '800', fontSize: 18 }}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.personName}>{item.name}</Text>
                <Text style={styles.personSub}>
                  {item.phone ? `📞 ${item.phone}` : '📞 Chưa có SĐT'}
                </Text>
                <Text style={styles.personSub}>
                  📅 Hẹn: {item.dueDate || 'Chưa hẹn'}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.statusTag, { borderColor: color }]}>
                  <Text style={{ color, fontSize: 10, fontWeight: '700' }}>
                    {item.status || 'Chưa hẹn'}
                  </Text>
                </View>
                <Text style={[styles.amountText, {
                  color: item.type === 'receivable' ? '#ff4d4d' : '#00e676'
                }]}>
                  {item.balance.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Không có ai đang nợ</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19' },
  header: {
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 55 : 16, paddingBottom: 12,
    backgroundColor: '#0b0f19', borderBottomWidth: 1, borderBottomColor: '#1e293b',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    backgroundColor: '#1e3a5f', margin: 16, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#2563eb40',
  },
  infoText: { color: '#93c5fd', fontSize: 13, textAlign: 'center' },
  notifyBox: {
    backgroundColor: '#111827', marginHorizontal: 16, marginBottom: 16, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#1e293b',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  notifyTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  notifySub: { color: '#64748b', fontSize: 11, marginTop: 3 },
  syncBtn: {
    backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  syncBtnActive: { backgroundColor: '#2563eb' },
  syncBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  personCard: {
    backgroundColor: '#111827', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: '#1e293b',
  },
  leftIndicator: { width: 4, alignSelf: 'stretch' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, margin: 12,
  },
  cardInfo: { flex: 1 },
  personName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  personSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', padding: 12 },
  statusTag: {
    borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 8, marginBottom: 6,
  },
  amountText: { fontSize: 14, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#475569', fontSize: 14 },
});
