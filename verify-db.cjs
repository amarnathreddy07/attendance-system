const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('attendance.db');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    console.log('Tables in database:', tables.map(t => t.name));
  });
  
  db.close();
});