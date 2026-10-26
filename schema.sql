CREATE TABLE IF NOT EXISTS teachers (
  teacher_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  class_id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL,
  teacher_id TEXT,
  attendance_threshold INTEGER NOT NULL DEFAULT 75,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

CREATE TABLE IF NOT EXISTS class_teachers (
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (class_id, teacher_id),
  FOREIGN KEY (class_id) REFERENCES classes(class_id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  application_number TEXT,
  roll_number TEXT,
  prn_number TEXT,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(class_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  date TEXT NOT NULL,
  teacher_id TEXT,
  name TEXT,
  start_time TEXT,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status = 'submitted'),
  FOREIGN KEY (class_id) REFERENCES classes(class_id),
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('P', 'A', 'OD')),
  marked_by TEXT,
  client_operation_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (class_id) REFERENCES classes(class_id)
);

CREATE TABLE IF NOT EXISTS sync_log (
  client_operation_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  processed_at TEXT,
  result TEXT
);