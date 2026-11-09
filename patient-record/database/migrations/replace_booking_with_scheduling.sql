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

INSERT IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes, is_active)
SELECT users.id, weekdays.weekday, '09:00:00', '16:00:00', 30, 1
FROM users
JOIN (
  SELECT 1 AS weekday UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
) AS weekdays
WHERE users.role_id = 2 AND users.status = 'active';

SET @copy_appointment_gmail = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'gmail'
  ),
  'UPDATE patients p JOIN appointments a ON a.patient_id = p.id SET p.email = a.gmail WHERE LENGTH(p.email) = 0 AND LENGTH(a.gmail) > 0',
  'SELECT 1'
);
PREPARE copy_appointment_gmail_stmt FROM @copy_appointment_gmail;
EXECUTE copy_appointment_gmail_stmt;
DEALLOCATE PREPARE copy_appointment_gmail_stmt;

SET @drop_appointment_gmail = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'gmail'
  ),
  'ALTER TABLE appointments DROP COLUMN gmail',
  'SELECT 1'
);
PREPARE drop_appointment_gmail_stmt FROM @drop_appointment_gmail;
EXECUTE drop_appointment_gmail_stmt;
DEALLOCATE PREPARE drop_appointment_gmail_stmt;

SET @drop_appointment_code = IF(
  EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'code'
  ),
  'ALTER TABLE appointments DROP COLUMN code',
  'SELECT 1'
);
PREPARE drop_appointment_code_stmt FROM @drop_appointment_code;
EXECUTE drop_appointment_code_stmt;
DEALLOCATE PREPARE drop_appointment_code_stmt;

UPDATE appointments SET status = 'pending' WHERE status = 'waiting-for-arrival';
