import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const WEB_TRANSACTIONS_KEY = 'transactions';

// 1. Logic cho Native (SQLite)
let db;
if (!isWeb) {
  db = SQLite.openDatabaseSync ? SQLite.openDatabaseSync('debtmanager.db') : SQLite.openDatabase('debtmanager.db');
  
  const initDB = () => {
    const query = `
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        balance REAL,
        type TEXT,
        status TEXT,
        dueDate TEXT,
        interestRate REAL,
        paidProgress INTEGER,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personId INTEGER NOT NULL,
        amount REAL,
        type TEXT,
        note TEXT,
        date TEXT
      );
    `;
    try {
      if (db.execSync) db.execSync(query);
      else db.transaction(tx => { tx.executeSql(query); });
    } catch (e) { console.log("Lỗi khởi tạo bảng:", e); }
  };
  initDB();
}

// 2. Các hàm export dùng chung
export const getPeople = async () => {
  if (isWeb) {
    const data = localStorage.getItem('debts');
    return data ? JSON.parse(data) : [];
  }
  
  if (db.getAllSync) return db.getAllSync('SELECT * FROM people ORDER BY id DESC;');
  return new Promise((resolve) => {
    db.transaction(tx => { tx.executeSql('SELECT * FROM people ORDER BY id DESC;', [], (_, { rows: { _array } }) => resolve(_array)); });
  });
};

export const addPerson = async (payload) => {
  if (isWeb) {
    const list = await getPeople();
    const newList = [{ ...payload, id: Date.now() }, ...list];
    localStorage.setItem('debts', JSON.stringify(newList));
    return;
  }

  const sql = `INSERT INTO people (name, phone, balance, type, status, dueDate, interestRate, paidProgress, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
  const params = [payload.name, payload.phone, payload.balance, payload.type, payload.status, payload.dueDate, payload.interestRate, payload.paidProgress, payload.createdAt];
  if (db.runSync) return db.runSync(sql, params);
  return new Promise((resolve, reject) => {
    db.transaction(tx => { tx.executeSql(sql, params, (_, res) => resolve(res), (_, err) => { reject(err); return false; }); });
  });
};

export const deletePerson = async (id) => {
  if (isWeb) {
    const list = await getPeople();
    const newList = list.filter(item => item.id !== id);
    localStorage.setItem('debts', JSON.stringify(newList));
    return;
  }
  if (db.runSync) return db.runSync('DELETE FROM people WHERE id = ?;', [id]);
  return new Promise((resolve) => {
    db.transaction(tx => { tx.executeSql('DELETE FROM people WHERE id = ?;', [id]); resolve(); });
  });
};

export const updatePerson = async (id, payload) => {
  if (isWeb) {
    const list = await getPeople();
    const newList = list.map(item => item.id === id ? { ...payload, id } : item);
    localStorage.setItem('debts', JSON.stringify(newList));
    return;
  }
  const sql = `UPDATE people SET name=?, phone=?, balance=?, type=?, status=?, dueDate=?, interestRate=?, paidProgress=?, createdAt=? WHERE id=?;`;
  const params = [payload.name, payload.phone, payload.balance, payload.type, payload.status, payload.dueDate, payload.interestRate, payload.paidProgress, payload.createdAt, id];
  if (db.runSync) return db.runSync(sql, params);
  return new Promise((resolve) => {
    db.transaction(tx => { tx.executeSql(sql, params); resolve(); });
  });
};

// 3. Lịch sử giao dịch (Ghi nợ / Trả nợ)
// type: 'debt' (ghi nợ, tăng số dư) | 'payment' (trả nợ, giảm số dư)

const getWebTransactions = () => {
  const data = localStorage.getItem(WEB_TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
};

const setWebTransactions = (list) => {
  localStorage.setItem(WEB_TRANSACTIONS_KEY, JSON.stringify(list));
};

export const getTransactionsByPerson = async (personId) => {
  if (isWeb) {
    return getWebTransactions().filter(t => t.personId === personId);
  }
  if (db.getAllSync) {
    return db.getAllSync('SELECT * FROM transactions WHERE personId = ? ORDER BY id ASC;', [personId]);
  }
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM transactions WHERE personId = ? ORDER BY id ASC;', [personId], (_, { rows: { _array } }) => resolve(_array));
    });
  });
};

export const addTransaction = async (personId, amount, type, note) => {
  const people = await getPeople();
  const person = people.find(p => p.id === personId);
  if (!person) return { error: 'Không tìm thấy khách nợ này.' };

  const delta = type === 'debt' ? amount : -amount;
  const newBalance = (parseFloat(person.balance) || 0) + delta;
  const date = new Date().toISOString();

  if (isWeb) {
    const list = getWebTransactions();
    list.push({ id: Date.now(), personId, amount, type, note: note || '', date });
    setWebTransactions(list);
    await updatePerson(personId, { ...person, balance: newBalance });
    return { success: true };
  }

  const sql = `INSERT INTO transactions (personId, amount, type, note, date) VALUES (?, ?, ?, ?, ?);`;
  const params = [personId, amount, type, note || '', date];
  if (db.runSync) {
    db.runSync(sql, params);
  } else {
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(sql, params, (_, res) => resolve(res), (_, err) => { reject(err); return false; });
      });
    });
  }
  await updatePerson(personId, { ...person, balance: newBalance });
  return { success: true };
};

export const deleteTransaction = async (transId) => {
  if (isWeb) {
    const list = getWebTransactions();
    const trans = list.find(t => t.id === transId);
    if (!trans) return { error: 'Không tìm thấy giao dịch.' };

    const people = await getPeople();
    const person = people.find(p => p.id === trans.personId);
    setWebTransactions(list.filter(t => t.id !== transId));

    if (person) {
      const delta = trans.type === 'debt' ? -trans.amount : trans.amount;
      const newBalance = (parseFloat(person.balance) || 0) + delta;
      await updatePerson(person.id, { ...person, balance: newBalance });
    }
    return { success: true };
  }

  const getOne = (sql, params) => {
    if (db.getAllSync) return db.getAllSync(sql, params);
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(sql, params, (_, { rows: { _array } }) => resolve(_array));
      });
    });
  };

  const rows = await getOne('SELECT * FROM transactions WHERE id = ?;', [transId]);
  const trans = rows && rows[0];
  if (!trans) return { error: 'Không tìm thấy giao dịch.' };

  if (db.runSync) {
    db.runSync('DELETE FROM transactions WHERE id = ?;', [transId]);
  } else {
    await new Promise((resolve) => {
      db.transaction(tx => { tx.executeSql('DELETE FROM transactions WHERE id = ?;', [transId]); resolve(); });
    });
  }

  const people = await getPeople();
  const person = people.find(p => p.id === trans.personId);
  if (person) {
    const delta = trans.type === 'debt' ? -trans.amount : trans.amount;
    const newBalance = (parseFloat(person.balance) || 0) + delta;
    await updatePerson(person.id, { ...person, balance: newBalance });
  }
  return { success: true };
};
