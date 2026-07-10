import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

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