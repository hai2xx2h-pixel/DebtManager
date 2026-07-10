import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { getPeople } from '../storage/db';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const [people, setPeople] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const data = await getPeople();
    setPeople(data);
  };

  const receivables = people.filter(p => p.type === 'receivable' && p.balance > 0);
  const payables = people.filter(p => p.type === 'payable' && p.balance > 0);
  const totalReceivable = receivables.reduce((sum, p) => sum + p.balance, 0);
  const totalPayable = payables.reduce((sum, p) => sum + p.balance, 0);
  const totalBalance = totalReceivable - totalPayable;

  const maxAmount = Math.max(...people.map(p => p.balance), 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thống kê</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* TỔNG QUAN */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Tổng tài sản ước tính</Text>
          <Text style={[styles.overviewAmount, { color: totalBalance >= 0 ? '#00e676' : '#ff4d4d' }]}>
            {totalBalance.toLocaleString('vi-VN')} đ
          </Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewItemLabel}>⬇️ Phải thu</Text>
              <Text style={[styles.overviewItemAmount, { color: '#ff4d4d' }]}>
                {totalReceivable.toLocaleString('vi-VN')} đ
              </Text>
              <Text style={styles.overviewCount}>{receivables.length} người</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewItemLabel}>⬆️ Phải trả</Text>
              <Text style={[styles.overviewItemAmount, { color: '#00e676' }]}>
                {totalPayable.toLocaleString('vi-VN')} đ
              </Text>
              <Text style={styles.overviewCount}>{payables.length} người</Text>
            </View>
          </View>
        </View>

        {/* BIỂU ĐỒ THANH */}
        {people.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>📊 Biểu đồ nợ theo người</Text>
            {people.filter(p => p.balance > 0).slice(0, 8).map((item, index) => (
              <View key={item.id} style={styles.barRow}>
                <Text style={styles.barName} numberOfLines={1}>
                  {item.name.length > 8 ? item.name.substring(0, 8) + '..' : item.name}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[styles.barFill, {
                    width: `${(item.balance / maxAmount) * 100}%`,
                    backgroundColor: item.type === 'receivable' ? '#ff4d4d' : '#00e676',
                  }]} />
                </View>
                <Text style={[styles.barAmount, {
                  color: item.type === 'receivable' ? '#ff4d4d' : '#00e676'
                }]}>
                  {(item.balance / 1000000).toFixed(1)}M
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* DANH SÁCH PHẢI THU */}
        {receivables.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.cardTitle}>⬇️ Họ nợ mình ({receivables.length} người)</Text>
            {receivables.sort((a, b) => b.balance - a.balance).map((item, index) => (
              <View key={item.id} style={styles.listRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.listRight}>
                  <Text style={styles.listAmount}>{item.balance.toLocaleString('vi-VN')} đ</Text>
                  <Text style={styles.listPercent}>
                    {totalReceivable > 0 ? ((item.balance / totalReceivable) * 100).toFixed(1) : 0}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* DANH SÁCH PHẢI TRẢ */}
        {payables.length > 0 && (
          <View style={styles.listCard}>
            <Text style={styles.cardTitle}>⬆️ Mình nợ họ ({payables.length} người)</Text>
            {payables.sort((a, b) => b.balance - a.balance).map((item, index) => (
              <View key={item.id} style={styles.listRow}>
                <View style={[styles.rankBadge, { backgroundColor: '#00e67620' }]}>
                  <Text style={[styles.rankText, { color: '#00e676' }]}>{index + 1}</Text>
                </View>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.listRight}>
                  <Text style={[styles.listAmount, { color: '#00e676' }]}>
                    {item.balance.toLocaleString('vi-VN')} đ
                  </Text>
                  <Text style={styles.listPercent}>
                    {totalPayable > 0 ? ((item.balance / totalPayable) * 100).toFixed(1) : 0}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {people.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>Chưa có dữ liệu thống kê</Text>
          </View>
        )}
      </ScrollView>
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
  scrollContent: { padding: 16, paddingBottom: 100 },
  overviewCard: {
    backgroundColor: '#111827', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#1e293b',
  },
  overviewLabel: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  overviewAmount: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewItemLabel: { color: '#94a3b8', fontSize: 11, marginBottom: 4 },
  overviewItemAmount: { fontSize: 15, fontWeight: '800' },
  overviewCount: { color: '#475569', fontSize: 11, marginTop: 2 },
  overviewDivider: { width: 1, height: 40, backgroundColor: '#1e293b' },
  chartCard: {
    backgroundColor: '#111827', borderRadius: 20, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#1e293b',
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  barName: { color: '#94a3b8', fontSize: 11, width: 70 },
  barContainer: {
    flex: 1, height: 8, backgroundColor: '#1f2937',
    borderRadius: 4, overflow: 'hidden', marginHorizontal: 8,
  },
  barFill: { height: '100%', borderRadius: 4 },
  barAmount: { fontSize: 11, fontWeight: '700', width: 35, textAlign: 'right' },
  listCard: {
    backgroundColor: '#111827', borderRadius: 20, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#1e293b',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ff4d4d20', justifyContent: 'center',
    alignItems: 'center', marginRight: 10,
  },
  rankText: { color: '#ff4d4d', fontWeight: '800', fontSize: 12 },
  listName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  listRight: { alignItems: 'flex-end' },
  listAmount: { color: '#ff4d4d', fontSize: 13, fontWeight: '800' },
  listPercent: { color: '#475569', fontSize: 11, marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#475569', fontSize: 14 },
});