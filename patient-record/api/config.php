<?php
declare(strict_types=1);

return [
    'host' => getenv('DRBACAL_DB_HOST') ?: '127.0.0.1',
    'database' => getenv('DRBACAL_DB_NAME') ?: 'dr_bacal_patient_record',
    'username' => getenv('DRBACAL_DB_USER') ?: 'root',
    'password' => getenv('DRBACAL_DB_PASSWORD') ?: '',
];
