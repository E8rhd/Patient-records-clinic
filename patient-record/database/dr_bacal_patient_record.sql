CREATE DATABASE IF NOT EXISTS dr_bacal_patient_record
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE dr_bacal_patient_record;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS specializations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  specialization_name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role_id INT UNSIGNED NOT NULL,
  specialization_id INT UNSIGNED NULL,
  contact_number VARCHAR(40) NOT NULL DEFAULT '',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_specialization FOREIGN KEY (specialization_id) REFERENCES specializations(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  contact_number VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(200) NOT NULL DEFAULT '',
  relationship VARCHAR(100) NOT NULL DEFAULT '',
  contact_number VARCHAR(40) NOT NULL DEFAULT '',
  CONSTRAINT fk_emergency_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medical_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL UNIQUE,
  allergies TEXT NOT NULL,
  chronic_conditions TEXT NOT NULL,
  past_surgeries TEXT NOT NULL,
  medications LONGTEXT NOT NULL,
  family_history TEXT NOT NULL,
  symptom_onset DATE NULL,
  smoking_status VARCHAR(30) NOT NULL DEFAULT '',
  smoking_packs_per_day DECIMAL(6,2) NULL,
  alcohol_use VARCHAR(30) NOT NULL DEFAULT '',
  exercise_level VARCHAR(30) NOT NULL DEFAULT '',
  emergency_contact_name VARCHAR(200) NOT NULL DEFAULT '',
  emergency_contact_relationship VARCHAR(100) NOT NULL DEFAULT '',
  emergency_contact_phone VARCHAR(40) NOT NULL DEFAULT '',
  insurance_provider VARCHAR(150) NOT NULL DEFAULT '',
  insurance_policy_number VARCHAR(120) NOT NULL DEFAULT '',
  updated_at DATETIME NULL,
  CONSTRAINT fk_history_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  chief_complaint TEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  specialization_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointments_patient (patient_id),
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT fk_appointments_specialization FOREIGN KEY (specialization_id) REFERENCES specializations(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctor_availability (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_doctor_availability_day (doctor_id, weekday),
  CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  notes TEXT NOT NULL,
  findings TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consultations_patient (patient_id),
  CONSTRAINT fk_consultations_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_consultations_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_consultations_doctor FOREIGN KEY (doctor_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vital_signs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL,
  temperature DECIMAL(5,2) NULL,
  blood_pressure VARCHAR(30) NOT NULL DEFAULT '',
  heart_rate DECIMAL(6,2) NULL,
  respiratory_rate DECIMAL(6,2) NULL,
  height DECIMAL(7,2) NULL,
  weight DECIMAL(7,2) NULL,
  recorded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vitals_appointment (appointment_id),
  CONSTRAINT fk_vitals_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_vitals_user FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS icd10 (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS medicines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  medication_name VARCHAR(200) NOT NULL,
  dosage_form VARCHAR(100) NOT NULL DEFAULT '',
  strength VARCHAR(100) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS diagnoses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  consultation_id INT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  diagnosis_text TEXT NOT NULL,
  lab_test VARCHAR(150) NOT NULL DEFAULT '',
  lab_remarks TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_diagnoses_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  consultation_id INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  dosage VARCHAR(120) NOT NULL,
  frequency VARCHAR(200) NOT NULL,
  duration VARCHAR(120) NOT NULL,
  instructions TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescriptions_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
  CONSTRAINT fk_prescriptions_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lab_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  consultation_id INT UNSIGNED NOT NULL,
  category VARCHAR(100) NOT NULL,
  test_name VARCHAR(200) NOT NULL,
  test_result TEXT NOT NULL,
  reference_range VARCHAR(200) NOT NULL,
  remarks TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS service_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(200) NOT NULL,
  service_category VARCHAR(120) NOT NULL DEFAULT '',
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  method_name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bills (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Unpaid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  billed_by INT UNSIGNED NULL,
  CONSTRAINT fk_bills_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_bills_user FOREIGN KEY (billed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bill_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bill_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_bill_items_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bill_id INT UNSIGNED NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  payment_method_id INT UNSIGNED NOT NULL,
  received_by INT UNSIGNED NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assisted_by INT UNSIGNED NULL,
  mode VARCHAR(60) NOT NULL DEFAULT '',
  CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES bills(id),
  CONSTRAINT fk_payments_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  CONSTRAINT fk_payments_receiver FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_assistant FOREIGN KEY (assisted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  patient_id INT UNSIGNED NULL,
  appointment_id INT UNSIGNED NULL,
  message TEXT NOT NULL,
  read_status TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO roles (id, role_name) VALUES
  (1, 'Admin'), (2, 'Doctor'), (3, 'Nurse'), (4, 'Secretary'), (5, 'Receptionist'), (6, 'Nurse-Receptionist');
INSERT IGNORE INTO specializations (id, specialization_name) VALUES
  (1, 'General Medicine'), (2, 'Cardiology'), (3, 'Pediatrics'), (4, 'Dermatology');
INSERT IGNORE INTO users
  (id, username, password_hash, first_name, last_name, email, role_id, specialization_id, contact_number, status)
VALUES
  (1, 'admin', SHA2('admin123', 256), 'System', 'Administrator', 'admin@drbacal.local', 1, NULL, '09170000000', 'active'),
  (2, 'doctor', SHA2('doctor123', 256), 'Doctor', 'User', 'doctor@drbacal.local', 2, 1, '09170000001', 'active'),
  (3, 'nurse', SHA2('nurse123', 256), 'Nurse', 'User', 'nurse@drbacal.local', 3, NULL, '09170000002', 'active'),
  (4, 'receptionist', SHA2('receptionist123', 256), 'Receptionist', 'User', 'receptionist@drbacal.local', 5, NULL, '09170000003', 'active'),
  (5, 'nurserecep', SHA2('nurserecep123', 256), 'Nurse', 'Receptionist', 'nurse.recep@drbacal.local', 6, NULL, '09170000004', 'active');

INSERT IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes, is_active)
SELECT users.id, weekdays.weekday, '09:00:00', '16:00:00', 30, 1
FROM users
JOIN (
  SELECT 1 AS weekday UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
) AS weekdays
WHERE users.role_id = 2 AND users.status = 'active';

INSERT IGNORE INTO patients
  (id, first_name, middle_name, last_name, birth_date, gender, address, contact_number, email, status, created_at)
VALUES
  (1, 'Juan', 'Dela', 'Cruz', '1995-03-15', 'Male', '123 Main Street, Manila', '09181234567', 'juan.cruz@example.com', 'active', NOW()),
  (2, 'Demo', '', 'Handoff', '1990-04-12', 'Female', 'Demo Clinic', '09170001001', 'demo.handoff@drbacal.local', 'active', NOW()),
  (3, 'Demo', '', 'Unpaid', '1985-09-21', 'Male', 'Demo Clinic', '09170001002', 'demo.unpaid@drbacal.local', 'active', NOW()),
  (4, 'Demo', '', 'Partial', '1978-02-03', 'Female', 'Demo Clinic', '09170001003', 'demo.partial@drbacal.local', 'active', NOW()),
  (5, 'Demo', '', 'Paid', '1998-11-15', 'Female', 'Demo Clinic', '09170001004', 'demo.paid@drbacal.local', 'active', NOW());

INSERT IGNORE INTO emergency_contacts (id, patient_id, full_name, relationship, contact_number) VALUES
  (1, 1, 'Maria Cruz', 'Spouse', '09181234568'),
  (2, 2, 'Demo Contact', 'Family', '09170001005');
INSERT IGNORE INTO medical_history
  (id, patient_id, allergies, chronic_conditions, past_surgeries, medications, family_history, symptom_onset, smoking_status, smoking_packs_per_day, alcohol_use, exercise_level, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, updated_at)
VALUES
  (1, 1, '{"selected":[],"other":"No known drug allergies."}', '{"selected":[],"other":"None reported."}', 'None reported.', '[{"name":"Paracetamol","dosage":"500mg","frequency":"","purpose":"Fever","notes":""}]', '{"selected":[],"other":"Not recorded."}', CURDATE(), 'Never', NULL, 'Never', 'Moderate', 'Maria Cruz', 'Spouse', '09181234568', NOW());

INSERT IGNORE INTO appointments
  (id, patient_id, doctor_id, appointment_date, appointment_time, status, chief_complaint, type, specialization_id, created_at)
VALUES
  (1, 1, 2, CURDATE(), '09:00:00', 'pending', 'Online schedule', 'appointment', 1, NOW()),
  (2, 2, 2, CURDATE(), CURTIME(), 'pending', 'DEMO HANDOFF: nurse to doctor', 'walkin', 1, NOW()),
  (3, 3, 2, CURDATE(), CURTIME(), 'confirmed', 'DEMO BILLING: unpaid balance', 'walkin', 1, NOW()),
  (4, 4, 2, CURDATE(), CURTIME(), 'confirmed', 'DEMO BILLING: partial balance', 'walkin', 1, NOW()),
  (5, 5, 2, CURDATE(), CURTIME(), 'confirmed', 'DEMO BILLING: paid balance', 'walkin', 1, NOW());
INSERT IGNORE INTO consultations
  (id, appointment_id, patient_id, doctor_id, notes, findings, plan, created_at)
VALUES
  (1, 1, 1, 2, 'Patient reports fever and mild cough for 3 days.', 'Mild upper respiratory symptoms.', 'Monitor hydration and prescribe medication.', NOW());
INSERT IGNORE INTO vital_signs
  (id, appointment_id, temperature, blood_pressure, heart_rate, respiratory_rate, height, weight, recorded_by, created_at)
VALUES
  (1, 1, 38.5, '120/80', 92, 20, 165, 62, 3, NOW()),
  (2, 2, 36.8, '118/76', 72, 16, 164, 58, 3, NOW());

INSERT IGNORE INTO icd10 (id, code, description) VALUES
  (1, 'A00', 'Cholera'), (2, 'E11', 'Type 2 diabetes mellitus'), (3, 'J00', 'Acute nasopharyngitis'),
  (4, 'I10', 'Essential hypertension'), (5, 'M54', 'Dorsalgia');
INSERT IGNORE INTO medicines (id, medication_name, dosage_form, strength) VALUES
  (1, 'Paracetamol', 'Tablet', '500mg'), (2, 'Amoxicillin', 'Capsule', '500mg'),
  (3, 'Amlodipine', 'Tablet', '5mg'), (4, 'Vitamin C', 'Capsule', '500mg');
INSERT IGNORE INTO diagnoses (id, consultation_id, code, diagnosis_text, lab_test, lab_remarks, created_at)
VALUES (1, 1, 'J00', 'Acute nasopharyngitis', '', '', NOW());
INSERT IGNORE INTO prescriptions (id, consultation_id, medicine_id, dosage, frequency, duration, instructions, created_at)
VALUES (1, 1, 1, '500mg', 'Every 6 hours', '3 days', 'Take as needed for fever.', NOW());

INSERT IGNORE INTO service_categories (id, category_name) VALUES
  (1, 'General'), (2, 'Diagnostics'), (3, 'Pharmacy');
INSERT IGNORE INTO services (id, service_name, service_category, base_price) VALUES
  (1, 'Consultation', 'General', 500), (2, 'Laboratory Test', 'Diagnostics', 1200),
  (3, 'Follow-up Checkup', 'General', 350), (4, 'Prescription Refill', 'Pharmacy', 250);
INSERT IGNORE INTO payment_methods (id, method_name, is_active) VALUES
  (1, 'Cash', 1), (2, 'GCash', 1), (3, 'PayMaya', 1), (4, 'Bank Transfer', 1);
INSERT IGNORE INTO bills (id, patient_id, status, created_at, billed_by) VALUES
  (1, 1, 'Unpaid', NOW(), NULL), (2, 3, 'Unpaid', NOW(), NULL),
  (3, 4, 'Partially Paid', NOW(), NULL), (4, 5, 'Paid', NOW(), NULL);
INSERT IGNORE INTO bill_items (id, bill_id, service_id, quantity, amount) VALUES
  (1, 1, 1, 1, 500), (2, 1, 2, 1, 1200), (3, 2, 1, 1, 500), (4, 2, 2, 1, 1200),
  (5, 3, 1, 1, 500), (6, 3, 3, 1, 350), (7, 4, 4, 1, 250);
INSERT IGNORE INTO payments (id, bill_id, amount_paid, payment_method_id, received_by, payment_date, mode) VALUES
  (1, 1, 500, 1, 4, NOW(), 'Cash'), (2, 3, 250, 1, 4, NOW(), 'Cash'), (3, 4, 250, 1, 4, NOW(), 'Cash');
