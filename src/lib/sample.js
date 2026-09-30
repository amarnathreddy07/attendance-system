const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Rohan', 'Kabir', 'Aryan', 'Karthik', 'Rahul', 'Amit', 'Rohit', 'Sanjay', 'Vikram', 'Nikhil', 'Abhinav', 'Siddharth', 'Kunal', 'Varun', 'Rahul', 'Amar', 'Anand', 'Deepak', 'Manish'];
const FIRST_F = ['Priya', 'Ananya', 'Diya', 'Aisha', 'Ishita', 'Sneha', 'Pooja', 'Neha', 'Riya', 'Kavya', 'Shreya', 'Anjali', 'Divya', 'Meera', 'Nisha', 'Tanvi', 'Kirti', 'Sunita', 'Rakhi', 'Pallavi', 'Geeta', 'Sonal', 'Payal', 'Shweta'];
const LAST = ['Sharma', 'Kumar', 'Patel', 'Singh', 'Reddy', 'Nath', 'Gupta', 'Joshi', 'Mehta', 'Bhat', 'Rao', 'Iyer', 'Menon', 'Das', 'Bose', 'Chopra', 'Malhotra', 'Saxena', 'Kapoor', 'Agarwal', 'Verma', 'Mishra', 'Tiwari', 'Nair'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateSampleStudents(count = 24, seed = Date.now()) {
  let rng = seed;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };
  const pickR = (list) => list[Math.floor(rand() * list.length)];

  const year = String(new Date().getFullYear());
  const students = [];
  const usedApps = new Set();
  const usedRolls = new Set();
  for (let i = 0; i < count; i += 1) {
    let app;
    do {
      app = `${year}${String(1000 + Math.floor(rand() * 9000))}`;
    } while (usedApps.has(app));
    usedApps.add(app);

    let roll;
    do {
      roll = `CS${String(i + 1).padStart(3, '0')}`;
    } while (usedRolls.has(roll));
    usedRolls.add(roll);

    const first = rand() > 0.5 ? pickR(FIRST_F) : pickR(FIRST);
    const last = pickR(LAST);
    const name = `${first} ${last}`;
    students.push({
      application_number: app,
      roll_number: roll,
      name,
      email: `${first.toLowerCase().replace(/\s/g, '')}.${last.toLowerCase()}@example.edu`,
      status: 'active',
    });
  }
  return students;
}

export function studentsToCsv(students) {
  const header = ['Application Number', 'Roll Number', 'Student Name', 'Email', 'Status'];
  const rows = students.map((s) => [s.application_number, s.roll_number, s.name, s.email, s.status]);
  const escape = (v) => {
    const str = v == null ? '' : String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}
