# XAMPP database setup

## Import the database

1. Copy the whole project folder into XAMPP's `htdocs` directory, for example:
   `C:\xampp\htdocs\dr-bacal-patient-record`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Open `http://localhost/phpmyadmin`.
4. Select **Import**, choose `database/dr_bacal_patient_record.sql`, then click **Import**.
   The script creates the `dr_bacal_patient_record` database, its tables, and demo records.
5. Open `http://localhost/dr-bacal-patient-record/` for staff login, or
   `http://localhost/dr-bacal-patient-record/schedule` for public patient scheduling.

Do not open the app using a `file:///` address when using MySQL. The backend is available through
Apache at `http://localhost/...`; pages opened directly from disk continue to use browser storage.
Existing browser-storage records are not automatically copied into MySQL; the SQL import installs
the included demo dataset.

## Demo accounts

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Doctor | `doctor` | `doctor123` |
| Nurse | `nurse` | `nurse123` |

Passwords are imported as SHA-256 bootstrap hashes and upgraded to PHP's password hash after the
first successful login. Change demo passwords before using the app with real patient data.

## Database connection

The defaults in `api/config.php` are for a standard local XAMPP installation (`root` with no
password). If your MySQL account is different, set `DRBACAL_DB_HOST`, `DRBACAL_DB_NAME`,
`DRBACAL_DB_USER`, and `DRBACAL_DB_PASSWORD` in the Apache/PHP environment or edit the local
configuration. Do not expose this demo configuration to a public server.

The application requires PHP 8.0 or newer, PHP's PDO MySQL driver, and PHP sessions. Ensure
`pdo_mysql` is enabled in XAMPP's `php.ini`.

## Existing database update

If the database was imported before the scheduling update, select `dr_bacal_patient_record` in
phpMyAdmin, open **Import**, and import `database/migrations/replace_booking_with_scheduling.sql`.
This adds doctor availability, copies any existing appointment Gmail addresses into the patient
record, and removes the retired appointment Gmail/code columns.
