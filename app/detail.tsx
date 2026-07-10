import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { addTransaction, deleteTransaction, getPeople, getTransactionsByPerson } from '../storage/db';

export default function DetailScreen() {
  const { id, name } = useLocalSearchParams();
  const personId = Number(id);
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState('debt');
  const [balance, setBalance] = useState(0);
  const [personName, setPersonName] = useState(name);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const people = await getPeople();
    const person = people.find(p => p.id === personId);
    if (person) {
      setBalance(person.balance);
      setPersonName(person.name);
    }
    const data = await getTransactionsByPerson(personId);
    setTransactions([...data].reverse());
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    const num = value.toString().replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parseCurrency = (value) => value.replace(/\./g, '');

  const handleAddTransaction = async () => {
    const numAmount = parseFloat(parseCurrency(amount));
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }
    const result = await addTransaction(personId, numAmount, type, note);
    if (result?.error) {
      Alert.alert('Lỗi', result.error);
      return;
    }
    setAmount('');
    setNote('');
    setModalVisible(false);
    await loadData();
  };

  const handleDelete = (transId) => {
    Alert.alert('Xác nhận', 'Xóa giao dịch này?', [
      { text: 'Hủy' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          await deleteTransaction(transId);
          await loadData();
        }
      }
    ]);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* BALANCE CARD */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceName}>{personName}</Text>
        <Text style={styles.balanceLabel}>Số dư nợ</Text>
        <Text style={[styles.balanceAmount, { color: balance > 0 ? '#ff4d4d' : '#00e676' }]}>
          {balance.toLocaleString('vi-VN')} đ
        </Text>
      </View>

      {/* TRANSACTION LIST */}
      <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.transCard}>
            <View style={[styles.transIndicator, { backgroundColor: item.type === 'debt' ? '#ff4d4d' : '#00e676' }]} />
            <View style={styles.transInfo}>
              <Text style={styles.transNote}>
                {item.note || (item.type === 'debt' ? 'Ghi nợ' : 'Trả nợ')}
              </Text>
              <Text style={styles.transDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={[styles.transAmount, { color: item.type === 'debt' ? '#ff4d4d' : '#00e676' }]}>
              {item.type === 'debt' ? '+' : '-'}{item.amount.toLocaleString('vi-VN')} đ
            </Text>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Text style={{ fontSize: 16 }}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
        }
      />

      {/* BOTTOM BUTTONS */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ff4d4d' }]}
          onPress={() => { setType('debt'); setModalVisible(true); }}
        >
          <Text style={styles.actionBtnText}>+ Ghi Nợ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#00e676' }]}
          onPress={() => { setType('payment'); setModalVisible(true); }}
        >
          <Text style={[styles.actionBtnText, { color: '#0b0f19' }]}>- Trả Nợ</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {type === 'debt' ? '+ Ghi Nợ' : '- Trả Nợ'}
            </Text>
            <Text style={styles.modalLabel}>Số tiền (đ)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              placeholderTextColor="#64748b"
              value={amount}
              onChangeText={(text) => setAmount(formatCurrency(parseCurrency(text)))}
              keyboardType="numeric"
            />
            <Text style={styles.modalLabel}>Ghi chú</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ghi chú (không bắt buộc)..."
              placeholderTextColor="#64748b"
              value={note}
              onChangeText={setNote}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: type === 'debt' ? '#ff4d4d' : '#00e676' }]}
                onPress={handleAddTransaction}
              >
                <Text style={{ color: type === 'debt' ? '#fff' : '#0b0f19', fontWeight: '700' }}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 55 : 16, paddingBottom: 12,
    backgroundColor: '#0b0f19', borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backBtn: { width: 80 },
  backText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  balanceCard: {
    backgroundColor: '#111827', margin: 16, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#1e293b',
  },
  balanceName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  balanceLabel: { color: '#94a3b8', fontSize: 12 },
  balanceAmount: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  transCard: {
    backgroundColor: '#111827', borderRadius: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: '#1e293b',
  },
  transIndicator: { width: 4, alignSelf: 'stretch' },
  transInfo: { flex: 1, padding: 12 },
  transNote: { color: '#fff', fontSize: 14, fontWeight: '600' },
  transDate: { color: '#64748b', fontSize: 11, marginTop: 2 },
  transAmount: { fontSize: 14, fontWeight: '800', paddingHorizontal: 8 },
  deleteBtn: { padding: 12 },
  emptyText: { textAlign: 'center', color: '#475569', marginTop: 40, fontSize: 14 },
  bottomButtons: {
    flexDirection: 'row', gap: 12, padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#0b0f19', borderTopWidth: 1, borderTopColor: '#1e293b',
  },
  actionBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1, borderColor: '#1e293b',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#1f2937', color: '#fff', padding: 12,
    borderRadius: 12, marginBottom: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#374151',
  },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
});
