<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
$secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params([
    'httponly' => true,
    'secure' => $secure,
    'samesite' => 'Strict',
    'path' => '/',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function requestBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        respond(400, ['error' => 'Request body must be a JSON object.']);
    }
    return $body;
}

function db(): PDO
{
    global $config;
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['database']
    );
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function collections(): array
{
    return [
        'roles' => ['table' => 'roles', 'columns' => ['role_name']],
        'specializations' => ['table' => 'specializations', 'columns' => ['specialization_name']],
        'users' => ['table' => 'users', 'columns' => ['username', 'password', 'first_name', 'last_name', 'email', 'role_id', 'specialization_id', 'contact_number', 'status']],
        'patients' => ['table' => 'patients', 'columns' => ['first_name', 'middle_name', 'last_name', 'birth_date', 'gender', 'address', 'contact_number', 'email', 'status', 'archived_at', 'created_at']],
        'emergencyContacts' => ['table' => 'emergency_contacts', 'columns' => ['patient_id', 'full_name', 'relationship', 'contact_number']],
        'medicalHistory' => ['table' => 'medical_history', 'columns' => ['patient_id', 'allergies', 'chronic_conditions', 'past_surgeries', 'medications', 'family_history', 'symptom_onset', 'smoking_status', 'smoking_packs_per_day', 'alcohol_use', 'exercise_level', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone', 'insurance_provider', 'insurance_policy_number', 'updated_at']],
        'appointments' => ['table' => 'appointments', 'columns' => ['patient_id', 'doctor_id', 'appointment_date', 'appointment_time', 'status', 'chief_complaint', 'type', 'specialization_id', 'created_at']],
        'consultations' => ['table' => 'consultations', 'columns' => ['appointment_id', 'patient_id', 'doctor_id', 'notes', 'findings', 'plan', 'created_at']],
        'vitalSigns' => ['table' => 'vital_signs', 'columns' => ['appointment_id', 'temperature', 'blood_pressure', 'heart_rate', 'respiratory_rate', 'height', 'weight', 'recorded_by', 'created_at']],
        'icd10' => ['table' => 'icd10', 'columns' => ['code', 'description']],
        'medicines' => ['table' => 'medicines', 'columns' => ['medication_name', 'dosage_form', 'strength']],
        'diagnoses' => ['table' => 'diagnoses', 'columns' => ['consultation_id', 'code', 'diagnosis_text', 'lab_test', 'lab_remarks', 'created_at']],
        'prescriptions' => ['table' => 'prescriptions', 'columns' => ['consultation_id', 'medicine_id', 'dosage', 'frequency', 'duration', 'instructions', 'created_at']],
        'labRequests' => ['table' => 'lab_requests', 'columns' => ['consultation_id', 'category', 'test_name', 'test_result', 'reference_range', 'remarks', 'created_at']],
        'serviceCategories' => ['table' => 'service_categories', 'columns' => ['category_name']],
        'services' => ['table' => 'services', 'columns' => ['service_name', 'service_category', 'base_price']],
        'paymentMethods' => ['table' => 'payment_methods', 'columns' => ['method_name', 'is_active']],
        'bills' => ['table' => 'bills', 'columns' => ['patient_id', 'status', 'created_at', 'billed_by']],
        'billItems' => ['table' => 'bill_items', 'columns' => ['bill_id', 'service_id', 'quantity', 'amount']],
        'payments' => ['table' => 'payments', 'columns' => ['bill_id', 'amount_paid', 'payment_method_id', 'received_by', 'payment_date', 'assisted_by', 'mode']],
        'notifications' => ['table' => 'notifications', 'columns' => ['type', 'patient_id', 'appointment_id', 'message', 'read', 'created_at']],
    ];
}

function tableInfo(string $collection): array
{
    $all = collections();
    if (!isset($all[$collection])) {
        respond(400, ['error' => 'Unknown data collection.']);
    }
    return $all[$collection];
}

function tableColumn(string $collection, string $column): string
{
    if ($collection === 'users' && $column === 'password') {
        return 'password_hash';
    }
    if ($collection === 'notifications' && $column === 'read') {
        return 'read_status';
    }
    return $column;
}

function currentUser(): ?array
{
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

function requireLogin(): array
{
    $user = currentUser();
    if (!$user || !in_array($user['role_name'] ?? '', ['Admin', 'Nurse', 'Doctor'], true)) {
        respond(401, ['error' => 'Your session has expired. Sign in again.']);
    }
    return $user;
}

function canMutate(string $collection, string $role, string $action): bool
{
    if ($role === 'Admin') {
        return true;
    }
    if ($action === 'delete' && !(
        $collection === 'vitalSigns' &&
        in_array($role, ['Nurse', 'Nurse-Receptionist'], true)
    )) {
        return false;
    }
    if ($role === 'Doctor' && $collection === 'patients' && $action !== 'update') {
        return false;
    }
    $permissions = [
        'Doctor' => ['patients', 'appointments', 'medicalHistory', 'consultations', 'diagnoses', 'medicines', 'prescriptions', 'labRequests'],
        'Nurse' => ['patients', 'emergencyContacts', 'medicalHistory', 'appointments', 'vitalSigns', 'notifications'],
        'Secretary' => ['patients', 'emergencyContacts', 'medicalHistory', 'appointments', 'notifications', 'bills', 'billItems', 'services', 'serviceCategories', 'payments'],
        'Receptionist' => ['bills', 'billItems', 'services', 'serviceCategories', 'payments'],
        'Nurse-Receptionist' => ['patients', 'emergencyContacts', 'medicalHistory', 'appointments', 'vitalSigns', 'notifications', 'bills', 'billItems', 'services', 'serviceCategories', 'payments'],
    ];
    return in_array($collection, $permissions[$role] ?? [], true);
}

function dbRowToApp(string $collection, array $row): array
{
    if ($collection === 'users') {
        unset($row['password_hash']);
        $row['password'] = '';
        $role = db()->prepare('SELECT role_name FROM roles WHERE id = ?');
        $role->execute([(int)$row['role_id']]);
        $row['role_name'] = $role->fetchColumn() ?: 'Unknown';
    } elseif ($collection === 'notifications') {
        $row['read'] = (int)$row['read_status'];
        unset($row['read_status']);
    }

    foreach (['id', 'patient_id', 'doctor_id', 'role_id', 'specialization_id', 'appointment_id', 'consultation_id', 'medicine_id', 'recorded_by', 'bill_id', 'service_id', 'payment_method_id', 'received_by', 'assisted_by'] as $key) {
        if (array_key_exists($key, $row) && $row[$key] !== null) {
            $row[$key] = (int)$row[$key];
        }
    }
    foreach (['temperature', 'heart_rate', 'respiratory_rate', 'height', 'weight', 'smoking_packs_per_day', 'base_price', 'amount', 'amount_paid'] as $key) {
        if (array_key_exists($key, $row) && $row[$key] !== null) {
            $row[$key] = (float)$row[$key];
        }
    }
    if (array_key_exists('quantity', $row)) {
        $row['quantity'] = (int)$row['quantity'];
    }
    if (array_key_exists('is_active', $row)) {
        $row['is_active'] = (int)$row['is_active'];
    }
    return $row;
}

function normalizeValue(string $collection, string $field, mixed $value): mixed
{
    if ($value === '' && in_array($field, [
        'archived_at', 'symptom_onset', 'smoking_packs_per_day', 'temperature',
        'heart_rate', 'respiratory_rate', 'height', 'weight', 'specialization_id',
        'recorded_by', 'billed_by', 'received_by', 'assisted_by',
    ], true)) {
        return null;
    }
    if ($collection === 'users' && $field === 'password') {
        return (string)$value;
    }
    if (is_string($value) && in_array($field, [
        'created_at', 'updated_at', 'payment_date', 'archived_at',
    ], true)) {
        return str_replace('T', ' ', $value);
    }
    return $value;
}

function snapshot(): array
{
    $result = [];
    foreach (collections() as $name => $info) {
        $rows = db()->query('SELECT * FROM `' . $info['table'] . '` ORDER BY id')->fetchAll();
        $result[$name] = array_map(
            static fn(array $row): array => dbRowToApp($name, $row),
            $rows
        );
    }
    return $result;
}

function createNotification(PDO $pdo, string $type, int $patientId, ?int $appointmentId, string $message): void
{
    $statement = $pdo->prepare(
        'INSERT INTO notifications (type, patient_id, appointment_id, message, read_status, created_at) VALUES (?, ?, ?, ?, 0, NOW())'
    );
    $statement->execute([$type, $patientId, $appointmentId, $message]);
}

function clinicTomorrow(): string
{
    return (new DateTimeImmutable('tomorrow', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

function clinicToday(): string
{
    return (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

function validateDoctor(PDO $pdo, int $doctorId, int $specializationId): bool
{
    $statement = $pdo->prepare(
        "SELECT COUNT(*) FROM users WHERE id = ? AND role_id = 2 AND status = 'active' AND specialization_id = ?"
    );
    $statement->execute([$doctorId, $specializationId]);
    return (int)$statement->fetchColumn() === 1;
}

function availableSlots(PDO $pdo, int $doctorId, string $date): array
{
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    $tomorrow = clinicTomorrow();
    if (!$day || $day->format('Y-m-d') !== $date || $date !== $tomorrow) {
        return [];
    }
    $availability = $pdo->prepare(
        "SELECT da.start_time, da.end_time, da.slot_minutes
         FROM doctor_availability da
         JOIN users u ON u.id = da.doctor_id
         WHERE da.doctor_id = ? AND da.weekday = ? AND da.is_active = 1
           AND u.role_id = 2 AND u.status = 'active' LIMIT 1"
    );
    $availability->execute([$doctorId, (int)$day->format('N')]);
    $schedule = $availability->fetch();
    if (!$schedule || (int)$schedule['slot_minutes'] < 1) {
        return [];
    }

    $booked = $pdo->prepare(
        "SELECT TIME_FORMAT(appointment_time, '%H:%i') FROM appointments
         WHERE doctor_id = ? AND appointment_date = ? AND status <> 'cancelled'"
    );
    $booked->execute([$doctorId, $date]);
    $occupied = array_fill_keys($booked->fetchAll(PDO::FETCH_COLUMN), true);
    $cursor = new DateTimeImmutable($date . ' ' . $schedule['start_time']);
    $end = new DateTimeImmutable($date . ' ' . $schedule['end_time']);
    $step = new DateInterval('PT' . (int)$schedule['slot_minutes'] . 'M');
    $slots = [];
    $now = new DateTimeImmutable();
    while ($cursor < $end) {
        $time = $cursor->format('H:i');
        if (!isset($occupied[$time]) && ($date !== date('Y-m-d') || $cursor > $now)) {
            $slots[] = $time;
        }
        $cursor = $cursor->add($step);
    }
    return $slots;
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = $_GET['action'] ?? '';

    if ($action === 'login' && $method === 'POST') {
        $body = requestBody();
        $statement = $pdo->prepare(
            "SELECT u.*, r.role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = ? AND u.status = 'active' LIMIT 1"
        );
        $statement->execute([trim((string)($body['username'] ?? ''))]);
        $user = $statement->fetch();
        $password = (string)($body['password'] ?? '');
        if (!$user || !in_array($user['role_name'], ['Admin', 'Nurse', 'Doctor'], true)) {
            respond(401, ['error' => 'This login is for Admin, Nurse, and Doctor accounts only.']);
        }
        $valid = $user && (
            password_verify($password, $user['password_hash']) ||
            hash_equals($user['password_hash'], hash('sha256', $password))
        );
        if (!$valid) {
            respond(401, ['error' => 'Invalid username or password, or the account is inactive.']);
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $update = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $update->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role_id' => (int)$user['role_id'],
            'specialization_id' => $user['specialization_id'] === null ? null : (int)$user['specialization_id'],
            'contact_number' => $user['contact_number'],
            'status' => $user['status'],
            'role_name' => $user['role_name'],
        ];
        respond(200, ['data' => $_SESSION['user']]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        respond(200, ['data' => true]);
    }

    if ($action === 'schedule_options' && $method === 'GET') {
        $specs = $pdo->query('SELECT id, specialization_name FROM specializations ORDER BY specialization_name')->fetchAll();
        $doctors = $pdo->query(
            "SELECT id, first_name, last_name, specialization_id FROM users WHERE role_id = 2 AND status = 'active' ORDER BY last_name, first_name"
        )->fetchAll();
        foreach ($doctors as &$doctor) {
            $doctor['id'] = (int)$doctor['id'];
            $doctor['specialization_id'] = $doctor['specialization_id'] === null ? null : (int)$doctor['specialization_id'];
        }
        $availability = $pdo->query(
            'SELECT doctor_id, weekday, start_time, end_time, slot_minutes FROM doctor_availability WHERE is_active = 1 ORDER BY doctor_id, weekday'
        )->fetchAll();
        foreach ($availability as &$row) {
            $row['doctor_id'] = (int)$row['doctor_id'];
            $row['weekday'] = (int)$row['weekday'];
            $row['slot_minutes'] = (int)$row['slot_minutes'];
        }
        respond(200, ['data' => ['specializations' => $specs, 'doctors' => $doctors, 'availability' => $availability]]);
    }

    if ($action === 'available_slots' && $method === 'GET') {
        $doctorId = filter_var($_GET['doctor_id'] ?? null, FILTER_VALIDATE_INT);
        $date = (string)($_GET['date'] ?? '');
        $doctorStatement = $pdo->prepare("SELECT id FROM users WHERE id = ? AND role_id = 2 AND status = 'active'");
        $doctorStatement->execute([$doctorId ?: 0]);
        if (!$doctorId || !$doctorStatement->fetchColumn()) {
            respond(422, ['error' => 'Select an active doctor.']);
        }
        $day = DateTime::createFromFormat('!Y-m-d', $date);
        $tomorrow = clinicTomorrow();
        if (!$day || $day->format('Y-m-d') !== $date || $date !== $tomorrow) {
            respond(422, ['error' => 'Appointments can only be scheduled for tomorrow.']);
        }
        respond(200, ['data' => availableSlots($pdo, $doctorId, $date)]);
    }

    if ($action === 'schedule_patient' && $method === 'POST') {
        $body = requestBody();
        $required = ['first_name', 'last_name', 'birth_date', 'gender', 'contact_number', 'address', 'email', 'appointment_date', 'appointment_time'];
        foreach ($required as $field) {
            if (trim((string)($body[$field] ?? '')) === '') {
                respond(422, ['error' => 'Complete all required scheduling fields.']);
            }
        }
        if (!in_array($body['gender'], ['Male', 'Female', 'Other'], true)) {
            respond(422, ['error' => 'Select a valid sex.']);
        }
        if (!filter_var((string)$body['email'], FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', (string)$body['email'])) {
            respond(422, ['error' => 'Enter a valid Gmail address ending in @gmail.com.']);
        }
        $birth = DateTime::createFromFormat('!Y-m-d', (string)$body['birth_date']);
        if (!$birth || $birth->format('Y-m-d') !== $body['birth_date'] || $birth->format('Y-m-d') > clinicToday()) {
            respond(422, ['error' => 'Enter a valid birth date.']);
        }
        $date = (string)$body['appointment_date'];
        $appointmentDate = DateTime::createFromFormat('!Y-m-d', $date);
        $tomorrow = clinicTomorrow();
        if (!$appointmentDate || $appointmentDate->format('Y-m-d') !== $date || $date !== $tomorrow) {
            respond(422, ['error' => 'Appointments can only be scheduled for tomorrow.']);
        }
        $time = DateTime::createFromFormat('!H:i', (string)$body['appointment_time']);
        if (!$time || $time->format('H:i') !== (string)$body['appointment_time']) {
            respond(422, ['error' => 'Choose an available appointment time.']);
        }
        $doctorId = filter_var($body['doctor_id'] ?? null, FILTER_VALIDATE_INT);
        $specializationId = filter_var($body['specialization_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$doctorId || !$specializationId || !validateDoctor($pdo, $doctorId, $specializationId)) {
            respond(422, ['error' => 'Select an active doctor for the chosen specialization.']);
        }

        $pdo->beginTransaction();
        $lock = $pdo->prepare('SELECT id FROM doctor_availability WHERE doctor_id = ? AND weekday = ? AND is_active = 1 FOR UPDATE');
        $lock->execute([$doctorId, (int)$appointmentDate->format('N')]);
        if (!$lock->fetchColumn() || !in_array($time->format('H:i'), availableSlots($pdo, $doctorId, $date), true)) {
            $pdo->rollBack();
            respond(409, ['error' => 'That time is no longer available. Choose another slot.']);
        }
        $patientStatement = $pdo->prepare(
            "INSERT INTO patients (first_name, middle_name, last_name, birth_date, gender, address, contact_number, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())"
        );
        $patientStatement->execute([
            trim((string)$body['first_name']),
            trim((string)($body['middle_name'] ?? '')),
            trim((string)$body['last_name']),
            $birth->format('Y-m-d'),
            $body['gender'],
            trim((string)$body['address']),
            trim((string)$body['contact_number']),
            trim((string)$body['email']),
        ]);
        $patientId = (int)$pdo->lastInsertId();
        $appointmentStatement = $pdo->prepare(
            "INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, chief_complaint, type, specialization_id, created_at) VALUES (?, ?, ?, ?, 'pending', 'Online schedule', 'appointment', ?, NOW())"
        );
        $appointmentStatement->execute([$patientId, $doctorId, $date, $time->format('H:i:s'), $specializationId]);
        $appointmentId = (int)$pdo->lastInsertId();
        createNotification($pdo, 'appointment', $patientId, $appointmentId, 'New online schedule: ' . trim((string)$body['first_name'] . ' ' . $body['last_name']) . ' on ' . (new DateTimeImmutable($date, new DateTimeZone('Asia/Manila')))->format('M j, Y') . ' at ' . $time->format('g:i A') . '.');
        $pdo->commit();
        respond(201, ['data' => ['patient_id' => $patientId, 'appointment_id' => $appointmentId]]);
    }

    $user = requireLogin();
    if ($action === 'snapshot' && $method === 'GET') {
        respond(200, ['data' => snapshot()]);
    }

    if (in_array($action, ['insert', 'update', 'delete'], true)) {
        $body = requestBody();
        $collection = (string)($body['collection'] ?? '');
        $info = tableInfo($collection);
        if (!canMutate($collection, (string)$user['role_name'], $action)) {
            respond(403, ['error' => 'Your account does not have permission to change this data.']);
        }
        $table = $info['table'];

        if ($action === 'insert') {
            $row = is_array($body['row'] ?? null) ? $body['row'] : [];
            $fields = array_values(array_intersect($info['columns'], array_keys($row)));
            $values = [];
            foreach ($fields as $field) {
                if ($collection === 'users' && $field === 'password') {
                    $values[] = password_hash((string)normalizeValue($collection, $field, $row[$field]), PASSWORD_DEFAULT);
                } else {
                    $values[] = normalizeValue($collection, $field, $row[$field]);
                }
            }
            if ($collection === 'users' && !in_array('password', $fields, true)) {
                respond(422, ['error' => 'A password is required for a new user.']);
            }
            if (!$fields) {
                respond(422, ['error' => 'No recognized fields were provided.']);
            }
            $dbFields = array_map(static fn(string $field): string => tableColumn($collection, $field), $fields);
            $quotedFields = array_map(static fn(string $field): string => '`' . $field . '`', $dbFields);
            $sql = 'INSERT INTO `' . $table . '` (' . implode(', ', $quotedFields) . ') VALUES (' .
                implode(', ', array_fill(0, count($fields), '?')) . ')';
            $insert = $pdo->prepare($sql);
            $insert->execute($values);
            $id = (int)$pdo->lastInsertId();
        } elseif ($action === 'update') {
            $id = filter_var($body['id'] ?? null, FILTER_VALIDATE_INT);
            $patch = is_array($body['patch'] ?? null) ? $body['patch'] : [];
            if (!$id) {
                respond(422, ['error' => 'A valid record id is required.']);
            }
            $fields = array_values(array_intersect($info['columns'], array_keys($patch)));
            if ($user['role_name'] === 'Doctor' && $collection === 'patients') {
                $fields = array_values(array_intersect($fields, ['archived_at']));
            }
            if (!$fields) {
                respond(422, ['error' => 'No recognized update fields were provided.']);
            }
            $sets = [];
            $values = [];
            foreach ($fields as $field) {
                $sets[] = '`' . tableColumn($collection, $field) . '` = ?';
                $value = normalizeValue($collection, $field, $patch[$field]);
                $values[] = $collection === 'users' && $field === 'password'
                    ? password_hash((string)$value, PASSWORD_DEFAULT)
                    : $value;
            }
            $values[] = $id;
            $update = $pdo->prepare('UPDATE `' . $table . '` SET ' . implode(', ', $sets) . ' WHERE id = ?');
            $update->execute($values);
            if ($update->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT COUNT(*) FROM `' . $table . '` WHERE id = ?');
                $exists->execute([$id]);
                if ((int)$exists->fetchColumn() === 0) {
                    respond(404, ['error' => 'Record not found.']);
                }
            }
        } else {
            $id = filter_var($body['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                respond(422, ['error' => 'A valid record id is required.']);
            }
            $delete = $pdo->prepare('DELETE FROM `' . $table . '` WHERE id = ?');
            $delete->execute([$id]);
            if ($delete->rowCount() === 0) {
                respond(404, ['error' => 'Record not found.']);
            }
            respond(200, ['data' => true]);
        }

        $select = $pdo->prepare('SELECT * FROM `' . $table . '` WHERE id = ?');
        $select->execute([$id]);
        $record = $select->fetch();
        respond(200, ['data' => $record ? dbRowToApp($collection, $record) : null]);
    }

    respond(404, ['error' => 'Unknown API action.']);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[Dr Bacal API] ' . $error->getMessage());
    respond(500, ['error' => 'The database request failed. Check the XAMPP database and PHP error log.']);
}
