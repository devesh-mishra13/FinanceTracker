import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
} from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from 'react-native-chart-kit';

const CATEGORY_OPTIONS = ['Food', 'Travel', 'Recharge', 'Shopping', 'Others'];

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingTxn, setPendingTxn] = useState(null); // txn waiting for category selection
  const lastMessageDate = useRef(null);

  const isUpiTransaction = (text) => {
    if (!text) return false;
    return /(UPI|VPA|BHIM|Google Pay|GPay|PhonePe|Paytm)/i.test(text);
  };

  const parseTransaction = (msg) => {
    let type = /debited/i.test(msg) ? 'debit' : /credited/i.test(msg) ? 'credit' : null;
    if (!type) return null;

    let amountMatch = msg.match(/debited by\s*₹?(\d+(?:\.\d{1,2})?)|credited by\s*₹?(\d+(?:\.\d{1,2})?)/i);
    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1] || amountMatch[2]);
    }

    return { type, amount, date: Date.now() };
  };

  // Load transactions from AsyncStorage on start
  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem('transactions');
      if (stored) setTransactions(JSON.parse(stored));
    };
    loadData();
  }, []);

  // Save transactions to AsyncStorage whenever they change
  useEffect(() => {
    AsyncStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Prompt user to pick category for new debit transaction
  const promptCategory = (txn) => {
    setPendingTxn(txn);
    setModalVisible(true);
  };

  // Add transaction with user category and save
  const saveTransactionWithCategory = (category) => {
    if (!pendingTxn) return;
    const txnWithCategory = { ...pendingTxn, category };
    setTransactions((prev) => [...prev, txnWithCategory]);
    setPendingTxn(null);
    setModalVisible(false);
  };

  // Fetch latest SMS, check for new UPI transactions
  const fetchLatestSMS = () => {
    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', maxCount: 5 }),
      (fail) => console.log('Failed: ' + fail),
      (count, smsList) => {
        const arr = JSON.parse(smsList);
        const newMessages = arr.filter(
          (m) => !lastMessageDate.current || m.date > lastMessageDate.current
        );
        if (newMessages.length > 0) {
          lastMessageDate.current = newMessages[0].date;

          // Process new messages
          for (let msg of newMessages) {
            if (isUpiTransaction(msg.body)) {
              const txn = parseTransaction(msg.body);
              if (txn) {
                // If debit and no category yet, prompt user
                if (txn.type === 'debit') {
                  promptCategory(txn);
                } else {
                  // For credit, just add
                  setTransactions((prev) => [...prev, txn]);
                }
              }
            }
          }
        }
      }
    );
  };

  useEffect(() => {
    fetchLatestSMS();
    const interval = setInterval(fetchLatestSMS, 30000); // every 30 sec
    return () => clearInterval(interval);
  }, []);

  // Calculate sums for pie charts
  const debitSum = transactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
  const creditSum = transactions
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  // Debit category sums
  const categorySums = CATEGORY_OPTIONS.map((cat) => {
    return {
      name: cat,
      amount: transactions
        .filter((t) => t.type === 'debit' && t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0),
      color: getColorForCategory(cat),
      legendFontColor: '#f5f5f7',
      legendFontSize: 12,
    };
  }).filter((entry) => entry.amount > 0); // Show only categories with amount

  // Simple color mapper for categories
  function getColorForCategory(cat) {
    switch (cat) {
      case 'Food':
        return '#FF6384';
      case 'Travel':
        return '#36A2EB';
      case 'Recharge':
        return '#FFCE56';
      case 'Shopping':
        return '#4BC0C0';
      case 'Others':
        return '#9966FF';
      default:
        return '#cccccc';
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Finance Tracker</Text>
      <PieChart
        data={[
          { name: 'Debited', amount: debitSum, color: '#FF6384', legendFontColor: '#f5f5f7', legendFontSize: 14 },
          { name: 'Credited', amount: creditSum, color: '#36A2EB', legendFontColor: '#f5f5f7', legendFontSize: 14 }
        ]}
        width={Dimensions.get('window').width - 40}
        height={200}
        chartConfig={{ backgroundColor: '#121212', color: () => '#f5f5f7' }}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft="15"
      />

      <Text style={[styles.header, { marginTop: 30 }]}>Debit Transactions by Category</Text>
      {categorySums.length > 0 ? (
        <PieChart
          data={categorySums}
          width={Dimensions.get('window').width - 40}
          height={200}
          chartConfig={{ backgroundColor: '#121212', color: () => '#f5f5f7' }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="15"
        />
      ) : (
        <Text style={styles.noCategoryText}>
          No categorized debit transactions yet.
        </Text>
      )}

      <ScrollView style={{ marginTop: 20 }}>
        {transactions.map((t, i) => (
          <Text key={i} style={styles.transactionText}>{`${t.type.toUpperCase()} ₹${t.amount} ${
            t.category ? `(${t.category})` : ''
          }`}</Text>
        ))}
      </ScrollView>

      {/* Modal for category selection */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category for Debit Transaction</Text>
            {CATEGORY_OPTIONS.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.modalButton}
                onPress={() => saveTransactionWithCategory(cat)}
              >
                <Text style={styles.modalButtonText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#121212', // Deep dark background
  },
  header: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 28,
    textAlign: 'center',
    color: '#f5f5f7', // almost white for sharp contrast
    letterSpacing: 2,
    fontFamily: 'Georgia', // classy serif font if available
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  noCategoryText: {
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    color: '#bbb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // darker overlay for focus
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#222222', // richer dark panel
    padding: 30,
    borderRadius: 14,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 12,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 25,
    color: '#f5f5f7',
    fontFamily: 'Georgia',
  },
  modalButton: {
    backgroundColor: '#4a90e2', // a cooler blue
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginVertical: 10,
    width: '100%',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'Arial',
  },
  transactionText: {
    color: '#e0e0e0',
    fontSize: 15,
    paddingVertical: 8,
    borderBottomWidth: 0.8,
    borderBottomColor: '#333',
    fontFamily: 'Arial',
  },
});
