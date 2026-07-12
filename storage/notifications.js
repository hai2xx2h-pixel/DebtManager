import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Cấu hình cách hiển thị thông báo khi app đang mở (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'debt-reminders';

// Xin quyền gửi thông báo (bắt buộc trên Android 13+ và iOS)
export const requestNotificationPermission = async () => {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nhắc nợ',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  return finalStatus === 'granted';
};

export const getNotificationPermissionStatus = async () => {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status; // 'granted' | 'denied' | 'undetermined'
};

// Chuyển chuỗi "DD/MM/YYYY" thành Date lúc 9h sáng, trả về null nếu không hợp lệ
const parseDueDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const d = new Date(year, month, day, 9, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
};

const beforeId = (personId) => `debt-reminder-before-${personId}`;
const dueId = (personId) => `debt-reminder-due-${personId}`;

// Hủy các thông báo đã lên lịch cho 1 người
export const cancelDebtReminders = async (personId) => {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(beforeId(personId));
  } catch (e) {}
  try {
    await Notifications.cancelScheduledNotificationAsync(dueId(personId));
  } catch (e) {}
};

// Lên lịch nhắc nợ cho 1 người: 1 lần trước hạn 1 ngày, 1 lần đúng ngày hẹn (9h sáng)
export const scheduleDebtReminder = async (person) => {
  if (Platform.OS === 'web') return;

  await cancelDebtReminders(person.id);

  // Không nhắc nếu đã hết nợ hoặc chưa hẹn ngày
  if (!person.balance || person.balance <= 0) return;
  const dueDate = parseDueDate(person.dueDate);
  if (!dueDate) return;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return;

  const now = new Date();
  const verb = person.type === 'receivable' ? 'thu nợ từ' : 'trả nợ cho';
  const amountStr = Math.abs(person.balance).toLocaleString('vi-VN') + ' đ';

  const beforeDate = new Date(dueDate);
  beforeDate.setDate(beforeDate.getDate() - 1);
  if (beforeDate > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: beforeId(person.id),
      content: {
        title: '🔔 Sắp đến hạn nợ',
        body: `Ngày mai đến hạn ${verb} ${person.name} - ${amountStr}`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: beforeDate, channelId: CHANNEL_ID },
    });
  }

  if (dueDate > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: dueId(person.id),
      content: {
        title: '⏰ Đến hạn hôm nay',
        body: `Hôm nay đến hạn ${verb} ${person.name} - ${amountStr}`,
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueDate, channelId: CHANNEL_ID },
    });
  }
};

// Lên lịch lại toàn bộ danh sách (dùng khi mở app hoặc bấm "Đồng bộ lại")
export const rescheduleAllReminders = async (people) => {
  if (Platform.OS === 'web') return;
  for (const person of people) {
    await scheduleDebtReminder(person);
  }
};
