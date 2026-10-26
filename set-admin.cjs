const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('attendance.db');

db.serialize(() => {
  // First insert the teacher
  db.run(
    "INSERT INTO teachers (teacher_id, name, email, role, active, created_at) VALUES ('tch_001', 'Amarnath Reddy', 'seepareddyamaranath7@gmail.com', 'teacher', 1, datetime('now'))",
    function(err) {
      if (err) {
        console.error('Error inserting teacher:', err);
        return;
      }
      console.log('Teacher inserted, now updating role...');
      
      // Now update the role to admin
      db.run(
        "UPDATE teachers SET role = 'admin' WHERE name = 'Amarnath Reddy' AND email = 'seepareddyamaranath7@gmail.com'",
        function(err) {
          if (err) {
            console.error('Error updating role:', err);
          } else {
            console.log('Rows updated:', this.changes);
          }
          db.close();
        }
      );
    }
  );
});