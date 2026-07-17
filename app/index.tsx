import { useFocusEffect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
// Hãy kiểm tra đường dẫn import này cho đúng với cấu trúc thư mục chứa file db.js của bạn
import { addPerson, deletePerson, getPeople, updatePerson } from '../storage/db';
import { cancelDebtReminders, scheduleDebtReminder } from '../storage/notifications';
import { confirmAction } from '../utils/confirm';

const { width } = Dimensions.get('window');

const formatCurrency = (value) => {
  if (!value) return '';
  const num = value.toString().replace(/\D/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseCurrency = (value) => {
  return value.replace(/\./g, '');
};

const calculateCurrentBalance = (item) => {
  const principal = parseFloat(item.balance) || 0;
  const ratePerMillionPerDay = parseFloat(item.interestRate) || 0; 
  
  if (ratePerMillionPerDay === 0 || !item.createdAt) return principal;

  const createdDate = new Date(item.createdAt);
  const currentDate = new Date();
  
  const diffTime = Math.max(0, currentDate.getTime() - createdDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays <= 0) return principal;

  const totalInterest = (principal / 1000000) * ratePerMillionPerDay * diffDays;
  return Math.round(principal + totalInterest);
};

export default function HomeScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('Tháng');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState('receivable');
  const [formStatus, setFormStatus] = useState('Đúng hạn');
  const [formDueDate, setFormDueDate] = useState('');
  const [formInterestRate, setFormInterestRate] = useState('');
  const [formPaidProgress, setFormPaidProgress] = useState('0');
  const [formCreatedAt, setFormCreatedAt] = useState(''); 

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const data = await getPeople();
      setDebts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Lỗi tải danh sách:', error);
    }
  };

  const { totalReceivable, totalPayable, totalBalance } = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    debts.forEach(item => {
      const currentAmount = calculateCurrentBalance(item);
      if (item.type === 'receivable') receivable += currentAmount;
      else payable += currentAmount;
    });
    return {
      totalReceivable: receivable,
      totalPayable: payable,
      totalBalance: receivable - payable
    };
  }, [debts]);

  const debtPercentage = useMemo(() => {
    const total = totalReceivable + totalPayable;
    if (total === 0) return 50; 
    return Math.round((totalReceivable / total) * 100);
  }, [totalReceivable, totalPayable]);

  const filteredDebts = useMemo(() => {
    return debts.filter(item =>
      (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.phone && item.phone.includes(searchQuery))
    );
  }, [debts, searchQuery]);

  const handleNotificationPress = () => {
    const upcomingDebts = debts.filter(item => item.status === 'Đến hạn' || item.status === 'Quá hạn');
    if (upcomingDebts.length === 0) {
      Alert.alert('Thông báo', 'Hệ thống không ghi nhận khoản nợ xấu hoặc quá hạn nào.');
    } else {
      Alert.alert('Nhắc nhở nợ', `Bạn đang có ${upcomingDebts.length} khoản nợ cần lưu ý.`);
    }
  };

  const openAddModal = () => {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    
    setSelectedDebt(null);
    setFormName('');
    setFormPhone('');
    setFormAmount('');
    setFormType('receivable');
    setFormStatus('Đúng hạn');
    setFormDueDate('');
    setFormInterestRate('');
    setFormPaidProgress('0');
    setFormCreatedAt(todayStr); 
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    let dateStr = '';
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      if (!isNaN(d.getTime())) {
        dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      }
    }

    setSelectedDebt(item);
    setFormName(item.name);
    setFormPhone(item.phone || '');
    setFormAmount(formatCurrency(item.balance ? item.balance.toString() : ''));
    setFormType(item.type || 'receivable');
    setFormStatus(item.status || 'Đúng hạn');
    setFormDueDate(item.dueDate || '');
    setFormInterestRate(item.interestRate ? item.interestRate.toString() : '');
    setFormPaidProgress(item.paidProgress ? item.paidProgress.toString() : '0');
    setFormCreatedAt(dateStr);
    setModalVisible(true);
  };

  const parseDateString = (dateStr) => {
    if (!dateStr) return new Date().toISOString();
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day, 12, 0, 0).toISOString();
      }
    } catch (e) {}
    return new Date().toISOString();
  };

  const handleSaveDebt = async () => {
    if (!formName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng điền Tên');
      return;
    }
    try {
      const amount = parseFloat(parseCurrency(formAmount)) || 0;
      const interestRateNum = parseFloat(parseCurrency(formInterestRate)) || 0;
      const progressNum = Math.min(100, Math.max(0, parseInt(formPaidProgress) || 0));
      const isoCreatedAt = parseDateString(formCreatedAt);

      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        balance: amount,
        type: formType,
        status: formStatus,
        dueDate: formDueDate || 'Chưa hẹn',
        interestRate: interestRateNum,
        paidProgress: progressNum,
        createdAt: isoCreatedAt,
      };

      if (selectedDebt) {
        await updatePerson(selectedDebt.id, payload);
        await scheduleDebtReminder({ ...payload, id: selectedDebt.id });
      } else {
        const res = await addPerson(payload);
        const newId = res && res.lastInsertRowId ? res.lastInsertRowId : null;
        if (newId) {
          await scheduleDebtReminder({ ...payload, id: newId });
        } else {
          // Web hoặc không lấy được id ngay: tìm lại theo dữ liệu vừa thêm
          const list = await getPeople();
          const created = list.find(p => p.name === payload.name && p.createdAt === payload.createdAt);
          if (created) await scheduleDebtReminder(created);
        }
      }
      setModalVisible(false);
      await loadData();
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu dữ liệu.');
    }
  };

  const handleDeleteDebt = (id) => {
    confirmAction('Xác nhận', 'Bạn muốn xóa khoản nợ này?', async () => {
      await deletePerson(id);
      await cancelDebtReminders(id);
      setModalVisible(false);
      await loadData();
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0d14" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>H</Text>
          </View>
          <View style={styles.userText}>
            <Text style={styles.welcomeText}>Xin chào,</Text>
            <Text style={styles.userName}>Hải 👋</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconCircle} onPress={handleNotificationPress}>
          <Text style={{ fontSize: 16 }}>🔔</Text>
          <View style={styles.badgeDot} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* TIME FILTER */}
        <View style={styles.timeFilterContainer}>
          {['Tuần', 'Tháng', 'Năm'].map((filter) => (
            <TouchableOpacity 
              key={filter} 
              style={[styles.timeFilterBtn, timeFilter === filter && styles.timeFilterBtnActive]}
              onPress={() => setTimeFilter(filter)}
            >
              <Text style={[styles.timeFilterText, timeFilter === filter && styles.timeFilterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CARD TỔNG TÀI SẢN */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Tổng tài sản ước tính ({timeFilter} này)</Text>
          <Text style={[styles.totalAmount, { color: totalBalance >= 0 ? '#00e676' : '#ff4d4d' }]}>
            {totalBalance.toLocaleString('vi-VN')} đ
          </Text>
          <Text style={styles.trendText}>📈 Thu chi cân đối <Text style={{ color: '#64748b' }}>dựa trên thống kê</Text></Text>

          {/* PROGRESS BAR */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressMiniLabel}>Họ nợ ({debtPercentage}%)</Text>
              <Text style={styles.progressMiniLabel}>Mình nợ ({100 - debtPercentage}%)</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${debtPercentage}%` }]} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.subColumnsRow}>
            <View style={[styles.subColumnCard, { borderColor: 'rgba(255,77,77,0.15)' }]}>
              <Text style={styles.colLabel}>Họ đang nợ mình</Text>
              <Text style={[styles.colAmount, { color: '#ff4d4d' }]}>{totalReceivable.toLocaleString('vi-VN')} đ</Text>
            </View>
            <View style={[styles.subColumnCard, { borderColor: 'rgba(0,230,118,0.15)' }]}>
              <Text style={styles.colLabel}>Mình đang nợ họ</Text>
              <Text style={[styles.colAmount, { color: '#00e676' }]}>{totalPayable.toLocaleString('vi-VN')} đ</Text>
            </View>
          </View>
        </View>

        {/* THANH TÌM KIẾM */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={{ marginRight: 8 }}>🔍</Text>
            <TextInput
              placeholder="Tìm theo tên hoặc số điện thoại..."
              placeholderTextColor="#475569"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
          Danh sách khách nợ ({filteredDebts.length})
        </Text>

        {/* LIST HIỂN THỊ */}
        {filteredDebts.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 30, marginBottom: 10 }}>📋</Text>
            <Text style={{ color: '#64748b' }}>Chưa có khoản nợ nào</Text>
          </View>
        ) : (
          filteredDebts.map((item) => {
            const currentAmount = calculateCurrentBalance(item); 
            const dayDiff = item.createdAt ? Math.floor((new Date().getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

            return (
              <View key={item.id} style={styles.debtCard}>
                <View style={styles.cardContent}>
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, { borderColor: item.type === 'receivable' ? '#ff4d4d' : '#00e676' }]}>
                      <Text style={{ color: item.type === 'receivable' ? '#ff4d4d' : '#00e676', fontWeight: '700' }}>
                        {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.debtName}>{item.name}</Text>
                      <Text style={styles.debtSub}>💰 Gốc: {(item.balance || 0).toLocaleString('vi-VN')}đ {dayDiff > 0 ? `(${dayDiff} ngày)` : '(Mới vay)'}</Text>
                      {parseFloat(item.interestRate) > 0 && <Text style={styles.interestBadgeText}>📈 Lãi: {item.interestRate}đ/triệu/ngày</Text>}
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={[styles.amountText, { color: item.type === 'receivable' ? '#ff4d4d' : '#00e676' }]}>
                        {currentAmount.toLocaleString('vi-VN')} đ
                      </Text>
                      <Text style={{ fontSize: 10, color: '#475569' }}>(Gốc + Lãi)</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.editIconBtn} onPress={() => openEditModal(item)}>
                      <Text style={{ fontSize: 13 }}>✏️ Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailBtn}
                      onPress={() => router.push({ pathname: '/detail', params: { id: item.id, name: item.name } })}
                    >
                      <Text style={styles.detailBtnTxt}>Lịch sử giao dịch ➔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* NÚT THÊM TRÒN ĐẸP CAO CẤP */}
      <TouchableOpacity style={styles.fabCircleButton} onPress={openAddModal}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      {/* MODAL NHẬP LIỆU */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{selectedDebt ? 'Cập Nhật' : 'Thêm Mới'}</Text>
            <ScrollView>
              <Text style={styles.modalLabel}>Họ và tên *</Text>
              <TextInput style={styles.modalInput} value={formName} onChangeText={setFormName} />

              <Text style={styles.modalLabel}>Số điện thoại</Text>
              <TextInput style={styles.modalInput} value={formPhone} onChangeText={setFormPhone} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Số tiền gốc (đ)</Text>
                  <TextInput keyboardType="numeric" style={styles.modalInput} value={formAmount} onChangeText={t => setFormAmount(formatCurrency(parseCurrency(t)))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Lãi/1 triệu/ngày (đ)</Text>
                  <TextInput keyboardType="numeric" style={styles.modalInput} value={formInterestRate} onChangeText={t => setFormInterestRate(formatCurrency(parseCurrency(t)))} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Ngày vay (DD/MM/YYYY) *</Text>
                  <TextInput style={styles.modalInput} value={formCreatedAt} onChangeText={setFormCreatedAt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Hạn trả (DD/MM/YYYY)</Text>
                  <TextInput style={styles.modalInput} value={formDueDate} onChangeText={setFormDueDate} />
                </View>
              </View>

              <Text style={styles.modalLabel}>Phân loại nợ</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity 
                  style={[{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#121824' }, formType === 'receivable' && { backgroundColor: '#ff4d4d' }]}
                  onPress={() => setFormType('receivable')}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>Họ nợ mình (Thu)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#121824' }, formType === 'payable' && { backgroundColor: '#00e676' }]}
                  onPress={() => setFormType('payable')}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>Mình nợ họ (Trả)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#334155' }]} onPress={() => setModalVisible(false)}><Text style={{ color: '#fff' }}>Hủy</Text></TouchableOpacity>
                {selectedDebt && <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleDeleteDebt(selectedDebt.id)}><Text style={{ color: '#fff' }}>Xóa</Text></TouchableOpacity>}
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#2563eb' }]} onPress={handleSaveDebt}><Text style={{ color: '#fff' }}>Lưu</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0d14' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 160, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 55 : 16, paddingBottom: 16 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  userText: { marginLeft: 12 },
  welcomeText: { color: '#475569', fontSize: 12 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#121824', justifyContent: 'center', alignItems: 'center' },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4d4d', position: 'absolute', top: 10, right: 11 },
  timeFilterContainer: { flexDirection: 'row', gap: 8, marginBottom: 16, justifyContent: 'flex-end' },
  timeFilterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#121824' },
  timeFilterBtnActive: { backgroundColor: '#2563eb' },
  timeFilterText: { color: '#64748b', fontSize: 12 },
  timeFilterTextActive: { color: '#fff' },
  totalCard: { backgroundColor: '#121824', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  totalLabel: { color: '#94a3b8', fontSize: 13 },
  totalAmount: { fontSize: 28, fontWeight: '900' },
  trendText: { fontSize: 12, color: '#00e676', marginTop: 4, marginBottom: 14 },
  progressSection: { marginBottom: 20, marginTop: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressMiniLabel: { color: '#64748b', fontSize: 11 },
  progressBarTrack: { height: 8, backgroundColor: '#ff4d4d', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00e676' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
  subColumnsRow: { flexDirection: 'row', gap: 12 },
  subColumnCard: { flex: 1, backgroundColor: '#0a0d14', padding: 14, borderRadius: 16, borderWidth: 1 },
  colLabel: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  colAmount: { fontSize: 15, fontWeight: '800' },
  searchContainer: { flexDirection: 'row', marginBottom: 20 },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: '#121824', height: 48, borderRadius: 16, alignItems: 'center', paddingHorizontal: 16 },
  searchInput: { flex: 1, color: '#fff' },
  debtCard: { backgroundColor: '#121824', borderRadius: 20, marginBottom: 14, padding: 16 },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  cardInfo: { flex: 1, marginLeft: 14 },
  debtName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  debtSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  interestBadgeText: { color: '#38bdf8', fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '800' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12 },
  editIconBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0a0d14', borderRadius: 10 },
  detailBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0a0d14', borderRadius: 10 },
  detailBtnTxt: { color: '#2563eb', fontSize: 11, fontWeight: '700' },
  fabCircleButton: { 
    position: 'absolute', 
    bottom: 95, 
    right: 20, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#2563eb', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 8, 
    shadowColor: '#2563eb', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 6 
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: width * 0.9, maxHeight: '85%', backgroundColor: '#0d1117', borderRadius: 24, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6, marginTop: 4 },
  modalInput: { backgroundColor: '#121824', color: '#fff', padding: 12, borderRadius: 12, marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
});
