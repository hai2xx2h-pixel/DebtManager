// storage/db.web.js
// File này cấu hình riêng cho Web trên Vercel để tránh lỗi bẻ lái từ expo-sqlite

export const addTransaction = async () => { 
  console.log("Web: addTransaction");
  return true; 
};

export const deleteTransaction = async () => { 
  console.log("Web: deleteTransaction");
  return true; 
};

export const getPeople = async () => { 
  return []; 
};

export const getTransactionsByPerson = async () => { 
  return []; 
};
