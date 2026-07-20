import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';

const balance = {
  total: 320.00,
  received: 480.00,
  pending: 160.00,
};

const chartData = [
  { date: '12/06', amount: 60, label: 'R$ 60' },
  { date: '19/06', amount: 85, label: 'R$ 85' },
  { date: '26/06', amount: 45, label: 'R$ 45' },
  { date: '03/07', amount: 120, label: 'R$ 120' },
  { date: '10/07', amount: 75, label: 'R$ 75' },
];

const devedores = [
  { id: '1', name: 'João Silva', amount: 15.00, event: 'Pelada 03/07' },
  { id: '2', name: 'Marcos Silva', amount: 15.00, event: 'Pelada 03/07' },
  { id: '3', name: 'Felipe Rocha', amount: 15.00, event: 'Pelada 03/07' },
];

const transactions = [
  { id: '1', name: 'Pedro Santos', event: 'Pelada 10/07', amount: 15.00, type: 'received', date: '10/07' },
  { id: '2', name: 'Lucas Lima', event: 'Pelada 10/07', amount: 15.00, type: 'received', date: '10/07' },
  { id: '3', name: 'João Silva', event: 'Pelada 03/07', amount: 15.00, type: 'pending', date: '03/07' },
  { id: '4', name: 'Diego Souza', event: 'Pelada 10/07', amount: 15.00, type: 'received', date: '10/07' },
];

const periods = [
  { key: 'mes', label: 'Este Mês' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: 'tudo', label: 'Tudo' },
];

const formatCurrency = (value) => {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
};

const FinanceiroScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('mes');

  const maxAmount = 120;

  return (
    <ScrollView style={styles.container}>
      {/* BALANCE CARD */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTopRow}>
          <Text style={styles.balanceLabel}>👛 Saldo do Caixa</Text>
          <Text style={styles.balanceUpdated}>Atualizado hoje</Text>
        </View>
        <Text style={styles.balanceTotal}>{formatCurrency(balance.total)}</Text>
        <View style={styles.balanceBottomRow}>
          <View>
            <Text style={styles.balanceSubLabel}>Recebido</Text>
            <Text style={styles.balanceSubValue}>{formatCurrency(balance.received)}</Text>
          </View>
          <View style={styles.balanceRightColumn}>
            <Text style={styles.balanceSubLabel}>Pendente</Text>
            <Text style={styles.balanceSubValue}>{formatCurrency(balance.pending)} ⚠️</Text>
          </View>
        </View>
      </View>

      {/* PERIOD FILTER */}
      <View style={styles.periodFilter}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.chip,
              selectedPeriod === period.key ? styles.chipSelected : styles.chipUnselected,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.chipText,
                selectedPeriod === period.key ? styles.chipTextSelected : styles.chipTextUnselected,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CHART CARD */}
      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>📊 Arrecadação por Pelada</Text>
        <View style={styles.chart}>
          {chartData.map((item, index) => {
            const barHeight = Math.max((item.amount / maxAmount) * 80, 4);
            const isTallest = item.amount === maxAmount;
            return (
              <View key={index} style={styles.barContainer}>
                {isTallest && (
                  <Text style={styles.barLabel}>{item.label}</Text>
                )}
                <View style={[styles.bar, { height: barHeight }]} />
                <Text style={styles.barDate}>{item.date}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* DEVEDORES SECTION */}
      <View style={styles.devedoresSection}>
        <Text style={styles.sectionTitle}>🚨 Devedores ({devedores.length})</Text>
        <Text style={styles.devedoresSubtitle}>{formatCurrency(balance.pending)} pendente</Text>
        <Card style={styles.listCard}>
          {devedores.map((devedor, index) => (
            <View key={devedor.id}>
              <View style={styles.listItem}>
                <Avatar name={devedor.name} size={36} style={styles.avatar} />
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{devedor.name}</Text>
                  <Text style={styles.listItemEvent}>{devedor.event}</Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.devedorAmount}>{formatCurrency(devedor.amount)}</Text>
                  <TouchableOpacity style={styles.cobrarButton}>
                    <Text style={styles.cobrarText}>Cobrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {index < devedores.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </Card>
      </View>

      {/* TRANSAÇÕES SECTION */}
      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>📋 Últimas Transações</Text>
        <Card style={styles.listCard}>
          {transactions.map((transaction, index) => (
            <View key={transaction.id}>
              <View style={styles.listItem}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: transaction.type === 'received' ? '#22C55E' : '#E74C3C' },
                  ]}
                />
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{transaction.name}</Text>
                  <Text style={styles.listItemEvent}>{transaction.event}</Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: transaction.type === 'received' ? '#22C55E' : '#E74C3C' },
                    ]}
                  >
                    {transaction.type === 'received' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>
              </View>
              {index < transactions.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  balanceCard: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 20,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  balanceUpdated: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  balanceTotal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  balanceBottomRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  balanceRightColumn: {
    marginLeft: 24,
  },
  balanceSubLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  balanceSubValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  periodFilter: {
    flexDirection: 'row',
    marginTop: 16,
  },
  chip: {
    marginRight: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#1D9E75',
  },
  chipUnselected: {
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipTextUnselected: {
    color: '#6B7280',
  },
  chartCard: {
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  barContainer: {
    alignItems: 'center',
  },
  bar: {
    width: 36,
    backgroundColor: '#1D9E75',
    borderRadius: 4,
  },
  barDate: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#1D9E75',
    position: 'absolute',
    top: -16,
  },
  devedoresSection: {
    marginTop: 20,
  },
  devedoresSubtitle: {
    fontSize: 12,
    color: '#E74C3C',
    marginBottom: 8,
  },
  listCard: {
    borderRadius: 8,
    padding: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avatar: {
    marginRight: 10,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C3E50',
  },
  listItemEvent: {
    fontSize: 11,
    color: '#6B7280',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  devedorAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
  },
  cobrarButton: {
    borderColor: '#E74C3C',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  cobrarText: {
    fontSize: 12,
    color: '#E74C3C',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  transactionsSection: {
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'right',
  },
});

export default FinanceiroScreen;