/* Dr Bacal Patient Record - offline data store (localStorage) */
window.Store = (() => {
  const DB_KEY = "drBacalPatientRecordDB";

  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = (date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const tomorrowISO = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return todayISO(tomorrow);
  };
  const formatDate = (value) => {
    if (!value) return "-";
    const iso = String(value).slice(0, 10);
    const parsed = new Date(`${iso}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };
  const formatTime = (value) => {
    if (!value) return "-";
    const [hour, minute] = String(value).slice(0, 5).split(":").map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return String(value);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  };
  const formatDateTime = (value) => {
    if (!value) return "-";
    const text = String(value);
    const date = formatDate(text.slice(0, 10));
    const time = text.length > 10 ? formatTime(text.slice(11, 16)) : "";
    return time && time !== "-" ? `${date} ${time}` : date;
  };
  const nowTime = (date = new Date()) =>
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const now = () => `${todayISO()}T${nowTime()}`;

  let db = null;
  let lastLoadedAt = 0;
  const backendEnabled = /^https?:$/.test(window.location.protocol);

  function showBackendError(message) {
    let box = document.getElementById("storeBackendError");
    if (!box && document.body) {
      box = document.createElement("div");
      box.id = "storeBackendError";
      box.setAttribute("role", "alert");
      box.style.cssText = "position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;padding:12px 16px;border:1px solid #b42318;border-radius:8px;background:#fdecec;color:#8f1d16;font:14px/1.5 Arial,sans-serif;box-shadow:0 4px 16px #0002";
      document.body.appendChild(box);
    }
    if (box) {
      box.textContent = message;
      box.classList.remove("hidden");
    }
  }

  function clearBackendError() {
    const box = document.getElementById("storeBackendError");
    if (box) box.remove();
  }

  function apiRequest(action, payload = null, method = "POST") {
    const request = new XMLHttpRequest();
    const query = method === "GET" && payload
      ? Object.entries(payload).map(([key, value]) => `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("")
      : "";
    const url = `api/index.php?action=${encodeURIComponent(action)}${query}`;
    request.open(method, url, false);
    request.withCredentials = true;
    if (method !== "GET") request.setRequestHeader("Content-Type", "application/json");
    try {
      request.send(method === "GET" ? null : JSON.stringify(payload || {}));
    } catch (error) {
      const message = "Could not reach the XAMPP API. Start Apache and MySQL, then open this app through http://localhost.";
      showBackendError(message);
      throw new Error(message, { cause: error });
    }
    let response;
    try {
      response = JSON.parse(request.responseText || "{}");
    } catch (error) {
      const message = "The XAMPP API returned an unreadable response. Check the PHP and Apache error logs.";
      showBackendError(message);
      throw new Error(message, { cause: error });
    }
    if (request.status < 200 || request.status >= 300) {
      const message = response.error || `The XAMPP API request failed (${request.status}).`;
      showBackendError(message);
      const error = new Error(message);
      error.status = request.status;
      throw error;
    }
    clearBackendError();
    return response.data;
  }

  function seed() {
    const today = todayISO();
    const created = now();
    return {
      roles: [
        { id: 1, role_name: "Admin" },
        { id: 2, role_name: "Doctor" },
        { id: 3, role_name: "Nurse" },
        { id: 4, role_name: "Secretary" },
        { id: 5, role_name: "Receptionist" },
        { id: 6, role_name: "Nurse-Receptionist" },
      ],
      specializations: [
        { id: 1, specialization_name: "General Medicine" },
        { id: 2, specialization_name: "Cardiology" },
        { id: 3, specialization_name: "Pediatrics" },
        { id: 4, specialization_name: "Dermatology" },
      ],
      users: [
        { id: 1, username: "admin", password: "admin123", first_name: "System", last_name: "Administrator", email: "admin@drbacal.local", role_id: 1, specialization_id: null, contact_number: "09170000000", status: "active" },
        { id: 2, username: "doctor", password: "doctor123", first_name: "Doctor", last_name: "User", email: "doctor@drbacal.local", role_id: 2, specialization_id: 1, contact_number: "09170000001", status: "active" },
        { id: 3, username: "nurse", password: "nurse123", first_name: "Nurse", last_name: "User", email: "nurse@drbacal.local", role_id: 3, specialization_id: null, contact_number: "09170000002", status: "active" },
        { id: 4, username: "receptionist", password: "receptionist123", first_name: "Receptionist", last_name: "User", email: "receptionist@drbacal.local", role_id: 5, specialization_id: null, contact_number: "09170000003", status: "active" },
        { id: 5, username: "nurserecep", password: "nurserecep123", first_name: "Nurse", last_name: "Receptionist", email: "nurse.recep@drbacal.local", role_id: 6, specialization_id: null, contact_number: "09170000004", status: "active" },
      ],
      patients: [
        { id: 1, first_name: "Juan", middle_name: "Dela", last_name: "Cruz", birth_date: "1995-03-15", gender: "Male", address: "123 Main Street, Manila", contact_number: "09181234567", email: "juan.cruz@example.com", status: "active", archived_at: null, created_at: created },
        { id: 2, first_name: "Demo", middle_name: "", last_name: "Handoff", birth_date: "1990-04-12", gender: "Female", address: "Demo Clinic", contact_number: "09170001001", email: "demo.handoff@drbacal.local", status: "active", archived_at: null, created_at: created },
        { id: 3, first_name: "Demo", middle_name: "", last_name: "Unpaid", birth_date: "1985-09-21", gender: "Male", address: "Demo Clinic", contact_number: "09170001002", email: "demo.unpaid@drbacal.local", status: "active", archived_at: null, created_at: created },
        { id: 4, first_name: "Demo", middle_name: "", last_name: "Partial", birth_date: "1978-02-03", gender: "Female", address: "Demo Clinic", contact_number: "09170001003", email: "demo.partial@drbacal.local", status: "active", archived_at: null, created_at: created },
        { id: 5, first_name: "Demo", middle_name: "", last_name: "Paid", birth_date: "1998-11-15", gender: "Female", address: "Demo Clinic", contact_number: "09170001004", email: "demo.paid@drbacal.local", status: "active", archived_at: null, created_at: created },
      ],
      emergencyContacts: [
        { id: 1, patient_id: 1, full_name: "Maria Cruz", relationship: "Spouse", contact_number: "09181234568" },
        { id: 2, patient_id: 2, full_name: "Demo Contact", relationship: "Family", contact_number: "09170001005" },
      ],
      medicalHistory: [
        {
          id: 1, patient_id: 1,
          allergies: JSON.stringify({ selected: [], other: "No known drug allergies." }),
          chronic_conditions: JSON.stringify({ selected: [], other: "None reported." }),
          past_surgeries: "None reported.",
          medications: JSON.stringify([{ name: "Paracetamol", dosage: "500mg", frequency: "", purpose: "Fever", notes: "" }]),
          family_history: JSON.stringify({ selected: [], other: "Not recorded." }),
          symptom_onset: today, smoking_status: "Never", smoking_packs_per_day: "",
          alcohol_use: "Never", exercise_level: "Moderate",
          emergency_contact_name: "Maria Cruz", emergency_contact_relationship: "Spouse", emergency_contact_phone: "09181234568",
          insurance_provider: "", insurance_policy_number: "", updated_at: created,
        },
      ],
      appointments: [
        { id: 1, patient_id: 1, doctor_id: 2, appointment_date: today, appointment_time: "09:00:00", status: "pending", chief_complaint: "Online schedule", type: "appointment", specialization_id: 1, created_at: created },
        { id: 2, patient_id: 2, doctor_id: 2, appointment_date: today, appointment_time: nowTime(), status: "pending", chief_complaint: "Walk-in", type: "walkin", specialization_id: 1, created_at: created },
        { id: 3, patient_id: 3, doctor_id: 2, appointment_date: today, appointment_time: nowTime(), status: "confirmed", chief_complaint: "Walk-in", type: "walkin", specialization_id: 1, created_at: created },
        { id: 4, patient_id: 4, doctor_id: 2, appointment_date: today, appointment_time: nowTime(), status: "confirmed", chief_complaint: "Walk-in", type: "walkin", specialization_id: 1, created_at: created },
        { id: 5, patient_id: 5, doctor_id: 2, appointment_date: today, appointment_time: nowTime(), status: "confirmed", chief_complaint: "Walk-in", type: "walkin", specialization_id: 1, created_at: created },
      ],
      doctorAvailability: [1, 2, 3, 4, 5].map((weekday) => ({
        doctor_id: 2, weekday, start_time: "09:00:00", end_time: "16:00:00", slot_minutes: 30, is_active: 1,
      })),
      consultations: [
        { id: 1, appointment_id: 1, patient_id: 1, doctor_id: 2, notes: "Patient reports fever and mild cough for 3 days.", findings: "Mild upper respiratory symptoms.", plan: "Monitor hydration and prescribe medication.", created_at: created },
      ],
      vitalSigns: [
        { id: 1, appointment_id: 1, temperature: 38.5, blood_pressure: "120/80", heart_rate: 92, respiratory_rate: 20, height: 165, weight: 62, recorded_by: 3, created_at: created },
        { id: 2, appointment_id: 2, temperature: 36.8, blood_pressure: "118/76", heart_rate: 72, respiratory_rate: 16, height: 164, weight: 58, recorded_by: 3, created_at: created },
      ],
      icd10: [
        { id: 1, code: "A00", description: "Cholera" },
        { id: 2, code: "E11", description: "Type 2 diabetes mellitus" },
        { id: 3, code: "J00", description: "Acute nasopharyngitis" },
        { id: 4, code: "I10", description: "Essential hypertension" },
        { id: 5, code: "M54", description: "Dorsalgia" },
      ],
      medicines: [
        { id: 1, medication_name: "Paracetamol", dosage_form: "Tablet", strength: "500mg" },
        { id: 2, medication_name: "Amoxicillin", dosage_form: "Capsule", strength: "500mg" },
        { id: 3, medication_name: "Amlodipine", dosage_form: "Tablet", strength: "5mg" },
        { id: 4, medication_name: "Vitamin C", dosage_form: "Capsule", strength: "500mg" },
      ],
      diagnoses: [
        { id: 1, consultation_id: 1, code: "J00", diagnosis_text: "Acute nasopharyngitis", created_at: created },
      ],
      prescriptions: [
        { id: 1, consultation_id: 1, medicine_id: 1, dosage: "500mg", frequency: "Every 6 hours", duration: "3 days", instructions: "Take as needed for fever.", created_at: created },
      ],
      labRequests: [],
      serviceCategories: [
        { id: 1, category_name: "General" },
        { id: 2, category_name: "Diagnostics" },
        { id: 3, category_name: "Pharmacy" },
      ],
      services: [
        { id: 1, service_name: "Consultation", service_category: "General", base_price: 500 },
        { id: 2, service_name: "Laboratory Test", service_category: "Diagnostics", base_price: 1200 },
        { id: 3, service_name: "Follow-up Checkup", service_category: "General", base_price: 350 },
        { id: 4, service_name: "Prescription Refill", service_category: "Pharmacy", base_price: 250 },
      ],
      paymentMethods: [
        { id: 1, method_name: "Cash", is_active: 1 },
        { id: 2, method_name: "GCash", is_active: 1 },
        { id: 3, method_name: "PayMaya", is_active: 1 },
        { id: 4, method_name: "Bank Transfer", is_active: 1 },
      ],
      bills: [
        { id: 1, patient_id: 1, status: "Unpaid", created_at: created, billed_by: null },
        { id: 2, patient_id: 3, status: "Unpaid", created_at: created, billed_by: null },
        { id: 3, patient_id: 4, status: "Partially Paid", created_at: created, billed_by: null },
        { id: 4, patient_id: 5, status: "Paid", created_at: created, billed_by: null },
      ],
      billItems: [
        { id: 1, bill_id: 1, service_id: 1, quantity: 1, amount: 500 },
        { id: 2, bill_id: 1, service_id: 2, quantity: 1, amount: 1200 },
        { id: 3, bill_id: 2, service_id: 1, quantity: 1, amount: 500 },
        { id: 4, bill_id: 2, service_id: 2, quantity: 1, amount: 1200 },
        { id: 5, bill_id: 3, service_id: 1, quantity: 1, amount: 500 },
        { id: 6, bill_id: 3, service_id: 3, quantity: 1, amount: 350 },
        { id: 7, bill_id: 4, service_id: 4, quantity: 1, amount: 250 },
      ],
      payments: [
        { id: 1, bill_id: 1, amount_paid: 500, payment_method_id: 1, received_by: 4, payment_date: created, assisted_by: null, mode: "Cash" },
        { id: 2, bill_id: 3, amount_paid: 250, payment_method_id: 1, received_by: 4, payment_date: created, assisted_by: null, mode: "Cash" },
        { id: 3, bill_id: 4, amount_paid: 250, payment_method_id: 1, received_by: 4, payment_date: created, assisted_by: null, mode: "Cash" },
      ],
      notifications: [],
    };
  }

  function load() {
    if (backendEnabled) {
      if (!db || Date.now() - lastLoadedAt > 1000) {
        db = apiRequest("snapshot", null, "GET");
        lastLoadedAt = Date.now();
      }
      return db;
    }
    if (db) return db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        db = JSON.parse(raw);
        let migrated = false;
        db.appointments.forEach((appointment) => {
          if (Object.hasOwn(appointment, "code") || Object.hasOwn(appointment, "gmail")) migrated = true;
          delete appointment.code;
          delete appointment.gmail;
        });
        if (migrated) save();
        return db;
      }
    } catch (e) {}
    db = seed();
    save();
    return db;
  }

  function save() {
    if (backendEnabled) {
      throw new Error("Direct database snapshots are disabled. Use Store.insert, Store.update, or Store.remove.");
    }
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function nextId(collection) {
    const rows = load()[collection] || [];
    return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
  }

  function insert(collection, row) {
    const data = load();
    if (backendEnabled) {
      const record = apiRequest("insert", { collection, row });
      data[collection].push(record);
      return record;
    }
    const record = { ...row, id: row.id || nextId(collection) };
    data[collection].push(record);
    save();
    return record;
  }

  function update(collection, id, patch) {
    const data = load();
    if (backendEnabled) {
      const record = apiRequest("update", { collection, id, patch });
      const index = data[collection].findIndex((row) => Number(row.id) === Number(id));
      if (index >= 0) data[collection][index] = record;
      return record;
    }
    const record = data[collection].find((row) => Number(row.id) === Number(id));
    if (!record) return null;
    Object.assign(record, patch);
    save();
    return record;
  }

  function remove(collection, id) {
    const data = load();
    if (backendEnabled) {
      apiRequest("delete", { collection, id });
      const index = data[collection].findIndex((row) => Number(row.id) === Number(id));
      if (index < 0) return false;
      data[collection].splice(index, 1);
      return true;
    }
    const index = data[collection].findIndex((row) => Number(row.id) === Number(id));
    if (index < 0) return false;
    data[collection].splice(index, 1);
    save();
    return true;
  }

  function reset() {
    if (backendEnabled) {
      throw new Error("Database reset is not available through the XAMPP backend.");
    }
    db = seed();
    save();
    return db;
  }

  function login(username, password) {
    if (backendEnabled) {
      try {
        return apiRequest("login", { username, password });
      } catch (error) {
        if (error.status === 401) {
          clearBackendError();
          return null;
        }
        throw error;
      }
    }
    const user = load().users.find(
      (row) => row.username === username && row.password === password && row.status === "active"
    );
    if (!user) return null;
    return publicUser(user);
  }

  function publicUser(user) {
    if (user.role_name) return { ...user, password: undefined };
    const role = load().roles.find((row) => Number(row.id) === Number(user.role_id));
    return { ...user, password: undefined, role_name: role ? role.role_name : "Unknown" };
  }

  function patientName(patientId) {
    const patient = load().patients.find((row) => Number(row.id) === Number(patientId));
    if (!patient) return "Unknown patient";
    return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  }

  function userName(userId) {
    const user = load().users.find((row) => Number(row.id) === Number(userId));
    if (!user) return "Unknown user";
    return `${user.first_name} ${user.last_name}`.trim();
  }

  function doctorName(userId) {
    return `Dr. ${userName(userId)}`;
  }

  function billTotals(billId) {
    const data = load();
    const items = data.billItems.filter((item) => Number(item.bill_id) === Number(billId));
    const payments = data.payments.filter((payment) => Number(payment.bill_id) === Number(billId));
    const total = items.reduce((sum, item) => sum + Number(item.amount) * Number(item.quantity || 1), 0);
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
    const balance = Math.max(0, total - paid);
    const status = balance <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
    return { total, paid, balance, status };
  }

  function refreshBillStatus(billId) {
    const bill = load().bills.find((row) => Number(row.id) === Number(billId));
    if (!bill) return null;
    return update("bills", billId, { status: billTotals(billId).status });
  }

  function logout() {
    if (backendEnabled) apiRequest("logout");
    db = null;
    lastLoadedAt = 0;
  }

  function scheduleOptions() {
    if (backendEnabled) return apiRequest("schedule_options", null, "GET");
    const data = load();
    return {
      specializations: data.specializations,
      doctors: data.users.filter((user) => Number(user.role_id) === 2 && user.status === "active"),
      availability: data.doctorAvailability || [],
    };
  }

  function availableSlots(doctorId, date) {
    if (backendEnabled) {
      return apiRequest("available_slots", { doctor_id: doctorId, date }, "GET");
    }
    const data = load();
    const weekday = new Date(`${date}T12:00:00`).getDay() || 7;
    const schedule = (data.doctorAvailability || []).find((row) =>
      Number(row.doctor_id) === Number(doctorId) && Number(row.weekday) === weekday && Number(row.is_active)
    );
    if (!schedule || date !== tomorrowISO()) return [];
    const slots = [];
    const [startHour, startMinute] = schedule.start_time.slice(0, 5).split(":").map(Number);
    const [endHour, endMinute] = schedule.end_time.slice(0, 5).split(":").map(Number);
    const first = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const interval = Number(schedule.slot_minutes) || 30;
    for (let minute = first; minute < end; minute += interval) {
      const slot = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
      const booked = data.appointments.some((appointment) =>
        Number(appointment.doctor_id) === Number(doctorId) &&
        appointment.appointment_date === date &&
        String(appointment.appointment_time).slice(0, 5) === slot &&
        appointment.status !== "cancelled"
      );
      if (!booked && (date !== todayISO() || slot > nowTime().slice(0, 5))) slots.push(slot);
    }
    return slots;
  }

  function schedulePatient(values) {
    if (backendEnabled) return apiRequest("schedule_patient", values);
    if (!values.email || !/^[^@\s]+@gmail\.com$/i.test(values.email)) throw new Error("Enter a valid Gmail address ending in @gmail.com.");
    if (!availableSlots(values.doctor_id, values.appointment_date).includes(values.appointment_time)) {
      throw new Error("That time is no longer available. Choose another slot.");
    }
    const patient = insert("patients", {
      first_name: values.first_name,
      middle_name: values.middle_name,
      last_name: values.last_name,
      birth_date: values.birth_date,
      gender: values.gender,
      address: values.address,
      contact_number: values.contact_number,
      email: values.email,
      status: "active",
      archived_at: null,
      created_at: now(),
    });
    const appointment = insert("appointments", {
      patient_id: patient.id,
      doctor_id: Number(values.doctor_id),
      appointment_date: values.appointment_date,
      appointment_time: `${values.appointment_time}:00`,
      status: "pending",
      chief_complaint: "Online schedule",
      type: "appointment",
      specialization_id: Number(values.specialization_id),
      created_at: now(),
    });
    insert("notifications", {
      type: "appointment",
      patient_id: patient.id,
      appointment_id: appointment.id,
      message: `New online schedule: ${patient.first_name} ${patient.last_name} on ${formatDate(values.appointment_date)} at ${formatTime(values.appointment_time)}.`,
      read: false,
      created_at: now(),
    });
    return { patient_id: patient.id, appointment_id: appointment.id };
  }

  return {
    DB_KEY, load, save, nextId, insert, update, remove, reset,
    login, publicUser, patientName, userName, doctorName,
    billTotals, refreshBillStatus,
    backendEnabled, logout, scheduleOptions, availableSlots, schedulePatient,
    todayISO, tomorrowISO, formatDate, formatTime, formatDateTime, nowTime, now,
  };
})();
