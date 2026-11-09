(function () {
  const doctor = Shared.requireRole(["Doctor"]);
  if (!doctor) return;

  const esc = Shared.escapeHtml;
  const messageBox = document.getElementById("message");
  let patientsCache = [];
  let appointmentsCache = [];
  let consultationsCache = [];
  let currentHistoryData = null;
  let historyPatients = [];
  let selectedHistoryPatientId = "";

  document.getElementById("doctorName").textContent = `${doctor.first_name} ${doctor.last_name}`;
  document.getElementById("doctorIdText").textContent = doctor.username;

  const notice = (text, error = false) => Shared.showMessage(messageBox, text, error);
  const emptyRow = (cols, text = "No records found.") => `<tr><td colspan="${cols}">${esc(text)}</td></tr>`;

  const setSelect = (id, rows, valueField, labelFn, includeEmpty = true) => {
    const select = document.getElementById(id);
    select.innerHTML = includeEmpty ? `<option value="">Select...</option>` : "";
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row[valueField];
      option.textContent = labelFn(row);
      select.appendChild(option);
    });
  };

  /* ---------- Appointments ---------- */
  const loadAppointments = () => {
    const data = Store.load();
    appointmentsCache = data.appointments
      .filter((appointment) => Number(appointment.doctor_id) === Number(doctor.id))
      .filter((appointment) => String(appointment.appointment_date).slice(0, 10) === Store.todayISO())
      .filter((appointment) => ["pending", "confirmed", "in-consultation", "completed"].includes(appointment.status))
      .map((appointment) => ({
        ...appointment,
        patient_name: Store.patientName(appointment.patient_id),
      }))
      .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)));

    setSelect("consultAppointment", appointmentsCache, "id", (row) => `${row.patient_name} (${Store.formatDate(row.appointment_date)})`);
    renderSchedule();
    const consultSel = document.getElementById("consultAppointment");
    if (consultSel) {
      consultSel.onchange = () => syncConsultationPatient();
      if (appointmentsCache.length === 1) {
        consultSel.value = String(appointmentsCache[0].id);
        syncConsultationPatient();
      }
    }
  };

  const renderSchedule = () => {
    const body = document.getElementById("doctorScheduleBody");
    if (!body) return;
    body.innerHTML = appointmentsCache.length
      ? appointmentsCache.map((appointment) => {
          const active = appointment.status === "in-consultation";
          const finished = appointment.status === "completed";
          const action = finished
            ? "Completed"
            : `<button class="small-btn" data-accept-appointment="${appointment.id}">${active ? "Continue Consultation" : "Accept"}</button>`;
          return `<tr><td>${esc(Store.formatTime(appointment.appointment_time))}</td><td>${esc(appointment.patient_name)}</td><td>${esc(appointment.status)}</td><td>${action}</td></tr>`;
        }).join("")
      : emptyRow(4, "No patients are scheduled for today.");
  };

  const acceptAppointment = (appointmentId) => {
    const appointment = appointmentsCache.find((row) => Number(row.id) === Number(appointmentId));
    if (!appointment) return;
    let consultation = Store.load().consultations.find((row) => Number(row.appointment_id) === Number(appointmentId));
    if (!consultation) {
      consultation = Store.insert("consultations", {
        appointment_id: Number(appointment.id),
        patient_id: Number(appointment.patient_id),
        doctor_id: Number(doctor.id),
        notes: "",
        findings: "",
        plan: "",
        created_at: Store.now(),
      });
    }
    Store.update("appointments", appointment.id, { status: "in-consultation" });
    loadAppointments();
    document.querySelector('[data-section="consultations"]').click();
    document.getElementById("consultAppointment").value = String(appointment.id);
    syncConsultationPatient();
    document.getElementById("consultNotes").focus();
    notice(`Consultation started for ${appointment.patient_name}.`);
  };

  const showConsultHistoryQuick = (patientId) => {
    const data = Store.load();
    const patient = data.patients.find(p => p.id == patientId);
    const history = data.medicalHistory.find(h => h.patient_id == patientId);
    const box = document.getElementById("consultHistoryQuick");
    if (!box) return;
    if (!patient) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="record-item"><span>Patient</span>${esc([patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "))}</div>
      <div class="record-item"><span>Allergies</span>${esc(history ? Shared.formatChoices(history.allergies) : "Not recorded")}</div>
      <div class="record-item"><span>Personal History</span>${esc(history ? Shared.formatChoices(history.chronic_conditions) : "Not recorded")}</div>
      <div class="record-item"><span>Medications</span>${esc(history ? Shared.formatMedications(history.medications) : "Not recorded").replaceAll("\\n", "<br>")}</div>
    `;
  };

  const syncConsultationPatient = () => {
    const appointmentId = document.getElementById("consultAppointment").value;
    const appointment = appointmentsCache.find((row) => String(row.id) === String(appointmentId));
    if (appointment) {
      document.getElementById("consultPatient").value = String(appointment.patient_id);
      showConsultHistoryQuick(appointment.patient_id);
    } else {
      document.getElementById("consultPatient").value = "";
      const box = document.getElementById("consultHistoryQuick");
      if (box) box.innerHTML = "";
    }
    renderConsultationVitals();
  };

  const renderConsultationVitals = () => {
    const body = document.getElementById("consultationVitalsBody");
    const appointmentId = document.getElementById("consultAppointment").value;
    if (!appointmentId) {
      body.innerHTML = emptyRow(8, "Select an appointment to see the chief complaint and vital signs.");
      return;
    }
    const appointment = appointmentsCache.find((row) => String(row.id) === String(appointmentId));
    const vital = Store.load().vitalSigns.find((row) => Number(row.appointment_id) === Number(appointmentId));
    const cells = vital
      ? `<td>${esc(vital.temperature)}</td><td>${esc(vital.blood_pressure)}</td><td>${esc(vital.heart_rate)}</td>
         <td>${esc(vital.respiratory_rate)}</td><td>${esc(vital.height)}</td><td>${esc(vital.weight)}</td>`
      : `<td colspan="6">No vital signs recorded yet for this appointment.</td>`;
    body.innerHTML = `<tr>
      <td>${esc(appointment ? appointment.patient_name : "-")}</td>
      <td>${esc(appointment ? appointment.chief_complaint : "-")}</td>
      ${cells}
    </tr>`;
  };

  const startAppointmentRecord = (appointmentId) => {
    document.querySelector('[data-section="consultations"]').click();
    document.getElementById("consultAppointment").value = String(appointmentId);
    syncConsultationPatient();
    document.getElementById("consultNotes").focus();
  };

  const viewAppointmentHistory = (patientId) => {
    document.querySelector('[data-section="history"]').click();
    selectHistoryPatient(patientId);
    loadHistory();
  };

  /* ---------- Patients ---------- */
  const searchPatients = () => {
    const query = document.getElementById("patientSearch").value.trim().toLowerCase();
    const archived = document.getElementById("patientArchiveFilter").value === "1";
    const data = Store.load();
    patientsCache = data.patients.filter((patient) => {
      if (archived ? !patient.archived_at : patient.archived_at) return false;
      if (!query) return true;
      const haystack = `${patient.first_name} ${patient.middle_name} ${patient.last_name} ${patient.id}`.toLowerCase();
      return haystack.includes(query);
    });

    document.getElementById("patientsBody").innerHTML = patientsCache.length
      ? patientsCache.map((patient) => `<tr>
          <td>${esc(patient.first_name)} ${esc(patient.middle_name)} ${esc(patient.last_name)}</td>
          <td>${esc(patient.gender)}</td>
          <td>${esc(Store.formatDate(patient.birth_date))}</td>
          <td>${esc(patient.contact_number)}</td>
          <td>
            ${archived
              ? `<button class="small-btn" data-view-patient="${patient.id}">View</button>
                 <button class="small-btn" data-restore-patient="${patient.id}">Restore</button>`
              : `<button class="small-btn" data-open-history="${patient.id}">Medical History</button>
                 <button class="small-btn" data-open-lab="${patient.id}">Laboratory</button>
                 <button class="small-btn" data-archive-patient="${patient.id}">Archive</button>`}
          </td>
        </tr>`).join("")
      : emptyRow(5);

    document.querySelectorAll("#patientsBody [data-open-history]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelector('[data-section="history"]').click();
        selectHistoryPatient(button.dataset.openHistory);
        loadHistory();
      });
    });
    document.querySelectorAll("#patientsBody [data-open-lab]").forEach((button) => {
      button.addEventListener("click", () => openPatientLaboratory(button.dataset.openLab));
    });
    document.querySelectorAll("#patientsBody [data-archive-patient]").forEach((button) => {
      button.addEventListener("click", () => setPatientArchived(button.dataset.archivePatient, true));
    });
    document.querySelectorAll("#patientsBody [data-restore-patient]").forEach((button) => {
      button.addEventListener("click", () => setPatientArchived(button.dataset.restorePatient, false));
    });
    document.querySelectorAll("#patientsBody [data-view-patient]").forEach((button) => {
      button.addEventListener("click", () => {
        const patient = Store.load().patients.find((row) => Number(row.id) === Number(button.dataset.viewPatient));
        if (patient) showPatientDetails(patient);
      });
    });
  };

  const setPatientArchived = (patientId, archive) => {
    Store.update("patients", patientId, { archived_at: archive ? Store.now() : null });
    notice(archive ? "Patient archived." : "Patient restored.");
    document.getElementById("patientArchiveFilter").value = archive ? "1" : "0";
    searchPatients();
    loadPatientsForSelects();
  };

  const showPatientDetails = (patient) => {
    alert(
      `Patient #${patient.id}\n${[patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ")}\n` +
      `Date of birth: ${Store.formatDate(patient.birth_date)}\nGender: ${patient.gender || "-"}\n` +
      `Contact: ${patient.contact_number || "-"}\nEmail: ${patient.email || "-"}\nAddress: ${patient.address || "-"}`
    );
  };

  const loadPatientsForSelects = () => {
    const data = Store.load();
    const allPatients = data.patients;
    historyPatients = allPatients;
    const activePatients = allPatients.filter((patient) => !patient.archived_at);
    const today = Store.todayISO();
    const todaysIds = new Set(
      appointmentsCache
        .filter((appointment) => String(appointment.appointment_date).slice(0, 10) === today)
        .map((appointment) => String(appointment.patient_id))
    );
    const todaysPatients = activePatients.filter((patient) => todaysIds.has(String(patient.id)));
    renderHistoryPatientSuggestions();
  };

  const getHistoryPatientName = (patient) =>
    [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");

  const renderHistoryPatientSuggestions = () => {
    const input = document.getElementById("historyPatientSearch");
    const list = document.getElementById("historyPatientSuggestions");
    const query = input.value.trim().toLowerCase();
    const matches = query
      ? historyPatients.filter((patient) =>
          `${getHistoryPatientName(patient)} ${patient.id}`.toLowerCase().includes(query)
        ).slice(0, 8)
      : [];
    const exactMatch = historyPatients.find((patient) =>
      getHistoryPatientName(patient).toLowerCase() === query
    );
    selectedHistoryPatientId = exactMatch ? String(exactMatch.id) : "";
    list.innerHTML = matches.map((patient) =>
      `<button type="button" role="option" class="patient-suggestion" data-history-patient="${patient.id}">
        <span>${esc(getHistoryPatientName(patient))}</span><small>Patient #${esc(patient.id)}</small>
      </button>`
    ).join("");
    list.classList.toggle("hidden", !matches.length);
    input.setAttribute("aria-expanded", String(matches.length > 0));
  };

  const selectHistoryPatient = (patientId) => {
    const patient = historyPatients.find((row) => Number(row.id) === Number(patientId))
      || Store.load().patients.find((row) => Number(row.id) === Number(patientId));
    if (!patient) return;
    selectedHistoryPatientId = String(patient.id);
    const input = document.getElementById("historyPatientSearch");
    input.value = getHistoryPatientName(patient);
    document.getElementById("historyPatientSuggestions").classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
  };

  const openPatientLaboratory = (patientId) => {
    document.querySelector('[data-section="laboratory"]').click();
    const consultation = Store.load().consultations
      .filter((row) => Number(row.patient_id) === Number(patientId))
      .sort((a, b) => b.id - a.id)[0];
    if (!consultation) {
      notice(`${Store.patientName(patientId)} has no consultation yet. Create a consultation first.`, true);
      return;
    }
    document.getElementById("labConsultation").value = String(consultation.id);
  };

  /* ---------- Medical history ---------- */
  const renderMedicationRows = (medications = []) => {
    const rows = medications.length ? medications : [{}];
    document.getElementById("historyMedicationRows").innerHTML = rows.map((medication) => `
      <tr>
        <td><input data-medication-field="name" aria-label="Medication name" value="${esc(medication.name || "")}"></td>
        <td><input data-medication-field="dosage" aria-label="Medication dose" value="${esc(medication.dosage || "")}"></td>
        <td><button class="small-btn remove-medication" type="button">Remove</button></td>
      </tr>`).join("");
  };

  const getMedicationRows = () =>
    Array.from(document.querySelectorAll("#historyMedicationRows tr"))
      .map((row) => Object.fromEntries(
        Array.from(row.querySelectorAll("[data-medication-field]")).map((input) => [input.dataset.medicationField, input.value.trim()])
      ))
      .filter((medication) => Object.values(medication).some(Boolean));

  const updateSmokingPacksVisibility = () => {
    const isCurrentSmoker = Boolean(document.querySelector('input[name="smokingStatus"][value="Current"]:checked'));
    const packsLabel = document.querySelector(".history-packs");
    packsLabel.classList.toggle("is-visible", isCurrentSmoker);
    packsLabel.setAttribute("aria-hidden", String(!isCurrentSmoker));
    document.getElementById("historySmokingPacks").disabled = !isCurrentSmoker;
  };

  const fillHistoryForm = (history, patient) => {
    const fields = {
      historyFirstName: patient.first_name || "",
      historyMiddleName: patient.middle_name || "",
      historyLastName: patient.last_name || "",
      historyBirthDate: Store.formatDate(patient.birth_date),
      historyGender: patient.gender || "",
      historyPhone: patient.contact_number || "",
      historyEmail: patient.email || "",
      historySymptomStart: history.symptom_onset || "",
      historyEmergencyName: history.emergency_contact_name || "",
      historyEmergencyRelationship: history.emergency_contact_relationship || "",
      historyEmergencyPhone: history.emergency_contact_phone || "",
      historyAllergies: Shared.parseChoices(history.allergies).other,
      historySurgeries: history.past_surgeries || "",
      historySmokingPacks: history.smoking_packs_per_day || "",
    };
    Object.entries(fields).forEach(([id, value]) => {
      if (id === "historySymptomStart") {
        DateSelect.setValue(id, value);
        return;
      }
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    const appointment = Store.load().appointments
      .filter((row) => Number(row.patient_id) === Number(patient.id))
      .sort((a, b) => String(b.appointment_date).localeCompare(String(a.appointment_date)))[0];
    document.getElementById("historyReasonForVisit").value = appointment ? appointment.chief_complaint || "" : "";

    const personal = Shared.parseChoices(history.chronic_conditions);
    const family = Shared.parseChoices(history.family_history);
    const allergies = Shared.parseChoices(history.allergies);
    const form = document.getElementById("medicalHistoryForm");

    form.querySelectorAll('input[name="personalHistory"]').forEach((input) => {
      input.checked = personal.selected.includes(input.value);
    });
    form.querySelectorAll('input[name="familyHistory"]').forEach((input) => {
      input.checked = family.selected.includes(input.value);
    });
    form.querySelectorAll('input[name="allergyHistory"]').forEach((input) => {
      input.checked = allergies.selected.includes(input.value);
    });
    document.getElementById("historyConditionsOther").value = personal.other || "";
    form.querySelectorAll('input[name="smokingStatus"]').forEach((input) => {
      input.checked = input.value === history.smoking_status;
    });
    updateSmokingPacksVisibility();
    form.querySelectorAll('input[name="alcoholUse"]').forEach((input) => {
      input.checked = input.value === history.alcohol_use;
    });
    form.querySelectorAll('input[name="exerciseLevel"]').forEach((input) => {
      input.checked = input.value === history.exercise_level;
    });
    renderMedicationRows(Shared.parseMedications(history.medications));
  };

  const historySummary = (history, patient) => {
    const visits = Store.load().consultations.filter((row) => Number(row.patient_id) === Number(patient.id));
    const appts = Store.load().appointments.filter((row) => Number(row.patient_id) === Number(patient.id));
    const vitals = Store.load().vitalSigns.filter((vital) =>
      Store.load().appointments.some((appointment) => appointment.id === vital.appointment_id && appointment.patient_id === patient.id)
    );
    const prescriptions = Store.load().prescriptions.filter((row) =>
      visits.some((visit) => visit.id === row.consultation_id)
    );
    const labs = Store.load().labRequests.filter((row) =>
      visits.some((visit) => visit.id === row.consultation_id)
    );

    return `
      <div class="record-item"><span>Patient</span>${esc([patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "))}</div>
      <div class="record-item"><span>Date of Birth</span>${esc(Store.formatDate(patient.birth_date))}</div>
      <div class="record-item"><span>Gender</span>${esc(patient.gender || "-")}</div>
      <div class="record-item"><span>Phone</span>${esc(patient.contact_number || "-")}</div>
      <div class="record-item"><span>Emergency Contact</span>${esc([history.emergency_contact_name, history.emergency_contact_relationship, history.emergency_contact_phone].filter(Boolean).join(" | ") || "-")}</div>
      <div class="record-item"><span>Allergies</span>${esc(Shared.formatChoices(history.allergies))}</div>
      <div class="record-item"><span>Personal History</span>${esc(Shared.formatChoices(history.chronic_conditions))}</div>
      <div class="record-item"><span>Past Surgeries</span>${esc(history.past_surgeries || "-")}</div>
      <div class="record-item"><span>Medications</span>${esc(Shared.formatMedications(history.medications)).replaceAll("\n", "<br>")}</div>
      <div class="record-item"><span>Family History</span>${esc(Shared.formatChoices(history.family_history))}</div>
      <div class="record-item"><span>Appointments</span>${appts.length}</div>
      ${appts.map((appointment) => `
        <div class="record-item"><span>${esc(Store.formatDate(appointment.appointment_date))} ${esc(Store.formatTime(appointment.appointment_time))}</span>
          ${esc(appointment.status)} - ${esc(appointment.chief_complaint || "No chief complaint")}
        </div>`).join("")}
      <div class="record-item"><span>Consultations</span>${visits.length}</div>
      ${visits.map((visit) => `
        <div class="record-item"><span>Consultation #${visit.id}</span>${esc(visit.notes || "No notes recorded")}
          ${visit.findings ? `<br>Findings: ${esc(visit.findings)}` : ""}
          ${visit.plan ? `<br>Plan: ${esc(visit.plan)}` : ""}
        </div>`).join("")}
      <div class="record-item"><span>Vital Sign Records</span>${vitals.length}</div>
      <div class="record-item"><span>Prescriptions</span>${prescriptions.length}</div>
      <div class="record-item"><span>Laboratory Requests</span>${labs.length}</div>
    `;
  };

  const openHistoryModal = () => {
    document.getElementById("historyModal").classList.remove("hidden");
  };
  const closeHistoryModal = () => {
    document.getElementById("historyModal").classList.add("hidden");
  };

  const getHistoryRecord = (patientId) =>
    Store.load().medicalHistory.find((row) => Number(row.patient_id) === Number(patientId)) || {};

  const loadHistory = () => {
    const patientId = selectedHistoryPatientId;
    if (!patientId) return notice("Select a patient to view medical history.", true);
    const patient = Store.load().patients.find((row) => Number(row.id) === Number(patientId));
    if (!patient) return;
    const history = getHistoryRecord(patientId);

    currentHistoryData = { patient, history };
    fillHistoryForm(history, patient);
    document.getElementById("historyResult").innerHTML = historySummary(history, patient);
    Shared.clearMessage(document.getElementById("historySaveMessage"));
    openHistoryModal();
  };

  const generateHistory = () => {
    const patientId = selectedHistoryPatientId;
    if (!patientId) return notice("Select a patient first.", true);
    const patient = Store.load().patients.find((row) => Number(row.id) === Number(patientId));
    if (!patient) return;
    const history = getHistoryRecord(patientId);
    currentHistoryData = { patient, history };

    const data = Store.load();
    const appointments = data.appointments.filter((row) => Number(row.patient_id) === Number(patient.id));
    const consultations = data.consultations.filter((row) => Number(row.patient_id) === Number(patient.id));
    const diagnoses = data.diagnoses.filter((row) => consultations.some((visit) => visit.id === row.consultation_id));
    const vitals = data.vitalSigns.filter((vital) =>
      appointments.some((appointment) => appointment.id === vital.appointment_id)
    );

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Medical History - ${esc([patient.first_name, patient.last_name].join(" "))}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #16232d; }
        h1 { font-size: 20px; text-align: center; margin: 0 0 4px; }
        .meta { text-align: center; color: #5b6b76; font-size: 11px; margin-bottom: 18px; }
        h2 { font-size: 13px; background: #eef2f6; border: 1px solid #c8d4dc; padding: 5px 8px; margin: 16px 0 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
        td, th { border: 1px solid #c8d4dc; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f4f7f9; }
        .label { color: #5b6b76; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
        @media print { body { margin: 12mm; } }
      </style></head><body>
      <h1>PATIENT MEDICAL HISTORY FORM</h1>
      <div class="meta">Dr Bacal Patient Record &middot; Generated ${esc(Store.formatDateTime(Store.now().replace("T", " ")))}</div>
      <h2>1. Patient Information</h2>
      <table>
        <tr><td><span class="label">Full name</span><br>${esc([patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "))}</td>
          <td><span class="label">Date of birth</span><br>${esc(Store.formatDate(patient.birth_date))}</td>
          <td><span class="label">Sex</span><br>${esc(patient.gender || "-")}</td></tr>
        <tr><td><span class="label">Phone</span><br>${esc(patient.contact_number || "-")}</td>
          <td colspan="2"><span class="label">Email / Address</span><br>${esc(patient.email || "-")} &middot; ${esc(patient.address || "-")}</td></tr>
        <tr><td><span class="label">Emergency contact</span><br>${esc(history.emergency_contact_name || "-")}</td>
          <td><span class="label">Relationship</span><br>${esc(history.emergency_contact_relationship || "-")}</td>
          <td><span class="label">Emergency phone</span><br>${esc(history.emergency_contact_phone || "-")}</td></tr>
      </table>
      <h2>2. Medical History</h2>
      <table>
        <tr><td><span class="label">Allergies</span><br>${esc(Shared.formatChoices(history.allergies))}</td>
          <td><span class="label">Personal history</span><br>${esc(Shared.formatChoices(history.chronic_conditions))}</td></tr>
        <tr><td><span class="label">Past surgeries</span><br>${esc(history.past_surgeries || "-")}</td>
          <td><span class="label">Medications</span><br>${esc(Shared.formatMedications(history.medications)).replaceAll("\n", "<br>")}</td></tr>
        <tr><td colspan="2"><span class="label">Family history</span><br>${esc(Shared.formatChoices(history.family_history))}</td></tr>
        <tr><td><span class="label">Smoking</span><br>${esc(history.smoking_status || "-")}</td>
          <td><span class="label">Alcohol / Exercise</span><br>${esc(history.alcohol_use || "-")} / ${esc(history.exercise_level || "-")}</td></tr>
      </table>
      <h2>3. Appointments</h2>
      <table><tr><th>Date</th><th>Time</th><th>Status</th><th>Chief complaint</th></tr>
        ${appointments.length ? appointments.map((appointment) => `<tr><td>${esc(Store.formatDate(appointment.appointment_date))}</td><td>${esc(Store.formatTime(appointment.appointment_time))}</td><td>${esc(appointment.status)}</td><td>${esc(appointment.chief_complaint || "-")}</td></tr>`).join("") : `<tr><td colspan="4">No appointments.</td></tr>`}
      </table>
      <h2>4. Consultations &amp; Diagnoses</h2>
      <table><tr><th>Date</th><th>Notes</th><th>Diagnosis</th></tr>
        ${consultations.length ? consultations.map((visit) => {
          const diagnosis = diagnoses.filter((row) => row.consultation_id === visit.id).map((row) => `${row.code} - ${row.diagnosis_text}`).join("; ");
          return `<tr><td>${esc(Store.formatDateTime(visit.created_at))}</td><td>${esc(visit.notes || "-")}</td><td>${esc(diagnosis || "-")}</td></tr>`;
        }).join("") : `<tr><td colspan="3">No consultations.</td></tr>`}
      </table>
      <h2>5. Vital Signs</h2>
      <table><tr><th>Date</th><th>Temp</th><th>BP</th><th>HR</th><th>RR</th><th>Height</th><th>Weight</th></tr>
        ${vitals.length ? vitals.map((vital) => `<tr><td>${esc(Store.formatDateTime(vital.created_at))}</td><td>${esc(vital.temperature)}</td><td>${esc(vital.blood_pressure)}</td><td>${esc(vital.heart_rate)}</td><td>${esc(vital.respiratory_rate)}</td><td>${esc(vital.height)}</td><td>${esc(vital.weight)}</td></tr>`).join("") : `<tr><td colspan="7">No vital signs.</td></tr>`}
      </table>
      <p style="margin-top:26px">Patient Signature: ______________________________ &nbsp;&nbsp; Date: ____________________</p>
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return notice("Allow pop-ups to generate the medical history.", true);
    printWindow.document.write(html);
    printWindow.document.close();
    notice("Medical history generated in a print-ready window.");
  };

  document.getElementById("medicalHistoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const patientId = selectedHistoryPatientId;
    if (!patientId) return notice("Select a patient first.", true);
    const form = event.currentTarget;
    const status = document.getElementById("historySaveMessage");
    const emergency = [
      document.getElementById("historyEmergencyName").value.trim(),
      document.getElementById("historyEmergencyRelationship").value.trim(),
      document.getElementById("historyEmergencyPhone").value.trim(),
    ];
    if (emergency.some(Boolean) && emergency.some((value) => !value)) {
      return Shared.showMessage(status, "Complete all emergency contact fields or leave them blank.", true);
    }

    const payload = {
      patient_id: Number(patientId),
      allergies: JSON.stringify({
        selected: Array.from(form.querySelectorAll('input[name="allergyHistory"]:checked')).map((input) => input.value),
        other: document.getElementById("historyAllergies").value.trim(),
      }),
      chronic_conditions: JSON.stringify({
        selected: Array.from(form.querySelectorAll('input[name="personalHistory"]:checked')).map((input) => input.value),
        other: document.getElementById("historyConditionsOther").value.trim(),
      }),
      past_surgeries: document.getElementById("historySurgeries").value,
      medications: JSON.stringify(getMedicationRows()),
      symptom_onset: document.getElementById("historySymptomStart").value,
      smoking_status: form.querySelector('input[name="smokingStatus"]:checked')?.value || "",
      smoking_packs_per_day: form.querySelector('input[name="smokingStatus"]:checked')?.value === "Current"
        ? document.getElementById("historySmokingPacks").value
        : "",
      alcohol_use: form.querySelector('input[name="alcoholUse"]:checked')?.value || "",
      exercise_level: form.querySelector('input[name="exerciseLevel"]:checked')?.value || "",
      family_history: JSON.stringify({
        selected: Array.from(form.querySelectorAll('input[name="familyHistory"]:checked')).map((input) => input.value),
        other: "",
      }),
      emergency_contact_name: emergency[0],
      emergency_contact_relationship: emergency[1],
      emergency_contact_phone: emergency[2],
      updated_at: Store.now(),
    };

    const existing = Store.load().medicalHistory.find((row) => Number(row.patient_id) === Number(patientId));
    if (existing) Store.update("medicalHistory", existing.id, payload);
    else Store.insert("medicalHistory", payload);

    const patient = Store.load().patients.find((row) => Number(row.id) === Number(patientId));
    const saved = getHistoryRecord(patientId);
    currentHistoryData = { patient, history: saved };
    document.getElementById("historyResult").innerHTML = historySummary(saved, patient);
    Shared.showMessage(status, "Medical history saved successfully.");
  });

  document.getElementById("addHistoryMedication").addEventListener("click", () => {
    renderMedicationRows([...getMedicationRows(), {}]);
  });

  document.getElementById("historyMedicationRows").addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-medication");
    if (!removeButton) return;
    removeButton.closest("tr").remove();
    if (!event.currentTarget.querySelector("tr")) renderMedicationRows();
  });

  document.getElementById("closeHistoryModal").addEventListener("click", closeHistoryModal);
  document.getElementById("printHistoryBtn").addEventListener("click", () => {
    closeHistoryModal();
    generateHistory();
  });

  /* ---------- Consultations / diagnosis / prescription / lab selects ---------- */
  const consultationRows = () =>
    Store.load().consultations
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((consultation) => ({
        ...consultation,
        patient_name: Store.patientName(consultation.patient_id),
      }));

  const loadConsultations = () => {
    consultationsCache = consultationRows();
    const label = (row) => `${row.patient_name} (${Store.formatDate(row.created_at)})`;
    setSelect("diagnosisConsultation", consultationsCache, "id", label);
    setSelect("prescriptionConsultation", consultationsCache, "id", label);
    setSelect("labConsultation", consultationsCache, "id", label);
    if (consultationsCache.length === 1) {
      ["diagnosisConsultation", "prescriptionConsultation", "labConsultation"].forEach((id) => {
        document.getElementById(id).value = String(consultationsCache[0].id);
      });
    }
  };

  document.getElementById("consultationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const appointmentId = document.getElementById("consultAppointment").value;
    const patientId = document.getElementById("consultPatient").value;
    if (!appointmentId || !patientId) return notice("Select an appointment first.", true);

    const existing = Store.load().consultations.find((row) => Number(row.appointment_id) === Number(appointmentId));
    let consultationId;
    if (existing) {
      Store.update("consultations", existing.id, {
        notes: document.getElementById("consultNotes").value,
      });
      consultationId = existing.id;
    } else {
      const record = Store.insert("consultations", {
        appointment_id: Number(appointmentId),
        patient_id: Number(patientId),
        doctor_id: doctor.id,
        notes: document.getElementById("consultNotes").value,
        findings: "",
        plan: "",
        created_at: Store.now(),
      });
      consultationId = record.id;
    }

    event.target.reset();
    syncConsultationPatient();
    document.querySelector('[data-section="diagnosis"]').click();
    document.getElementById("diagnosisConsultation").value = String(consultationId);
    document.getElementById("icd10").focus();
    notice(`Consultation #${consultationId} saved. Now add a diagnosis.`);
  });

  const renderDiagnoses = () => {
    const data = Store.load();
    document.getElementById("diagnosesBody").innerHTML = data.diagnoses.length
      ? data.diagnoses.slice().reverse().map((diagnosis) => {
          const consultation = data.consultations.find((row) => row.id === diagnosis.consultation_id);
          return `<tr>
            <td>${esc(consultation ? Store.patientName(consultation.patient_id) : "-")}</td>
            <td>${esc(diagnosis.code)}</td>
            <td>${esc(diagnosis.diagnosis_text || "-")}</td>
            <td>${esc(diagnosis.lab_test || "-")}</td>
            <td>${esc(Store.formatDateTime(diagnosis.created_at))}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="5">No diagnoses recorded.</td></tr>`;
  };

  document.getElementById("diagnosisForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const consultationId = document.getElementById("diagnosisConsultation").value;
    const code = document.getElementById("icd10").value;
    const icd = Store.load().icd10.find((row) => row.code === code);
    if (!consultationId || !code) return notice("Select a consultation and an ICD-10 code.", true);

    Store.insert("diagnoses", {
      consultation_id: Number(consultationId),
      code,
      diagnosis_text: document.getElementById("diagnosisNotes").value.trim() || (icd ? icd.description : ""),
      lab_test: "",
      lab_remarks: "",
      created_at: Store.now(),
    });
    event.target.reset();
    renderDiagnoses();
    loadConsultations();
    document.querySelector('[data-section="prescription"]').click();
    document.getElementById("prescriptionConsultation").value = String(consultationId);
    notice("Diagnosis saved. Continue to prescribe medicine.");
  });

  document.getElementById("requestLaboratory").addEventListener("click", () => {
    const consultationId = document.getElementById("diagnosisConsultation").value;
    const testName = document.getElementById("diagLabTest").value;
    if (!consultationId || !testName) return notice("Select a consultation and laboratory test first.", true);
    const existing = Store.load().labRequests.find((row) =>
      Number(row.consultation_id) === Number(consultationId) && row.test_name === testName
    );
    if (existing) return notice("This laboratory test has already been requested.");
    Store.insert("labRequests", {
      consultation_id: Number(consultationId),
      category: testName,
      test_name: testName,
      test_result: "",
      reference_range: "",
      remarks: document.getElementById("diagLabRemarks").value.trim(),
      created_at: Store.now(),
    });
    document.getElementById("diagLabTest").value = "";
    document.getElementById("diagLabRemarks").value = "";
    notice(`Laboratory request for ${testName} saved.`);
  });

  const renderPrescriptions = () => {
    const data = Store.load();
    document.getElementById("prescriptionsBody").innerHTML = data.prescriptions.length
      ? data.prescriptions.slice().reverse().map((prescription) => {
          const consultation = data.consultations.find((row) => row.id === prescription.consultation_id);
          const medicine = data.medicines.find((row) => row.id === prescription.medicine_id);
          return `<tr>
            <td>${esc(consultation ? Store.patientName(consultation.patient_id) : "-")}</td>
            <td>${esc(medicine ? medicine.medication_name : "-")}</td>
            <td>${esc(prescription.dosage)}</td>
            <td>${esc(prescription.frequency)}</td>
            <td>${esc(prescription.duration)}</td>
            <td>${esc(prescription.instructions)}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="6">No prescriptions recorded.</td></tr>`;
  };

  const loadMedicines = () => {
    setSelect("medicine", Store.load().medicines, "id", (row) => row.medication_name);
  };

  document.getElementById("toggleMedicineForm").addEventListener("click", (event) => {
    document.getElementById("medicineForm").classList.toggle("hidden");
    event.currentTarget.classList.toggle("hidden", !document.getElementById("medicineForm").classList.contains("hidden"));
  });
  document.getElementById("cancelMedicine").addEventListener("click", () => {
    document.getElementById("medicineForm").classList.add("hidden");
    document.getElementById("toggleMedicineForm").classList.remove("hidden");
    ["medicineName", "medicineFormType", "medicineStrength"].forEach((id) => {
      document.getElementById(id).value = "";
    });
  });
  document.getElementById("saveMedicine").addEventListener("click", () => {
    const name = document.getElementById("medicineName").value.trim();
    if (!name) return notice("Enter a medicine name.", true);
    if (Store.load().medicines.some((row) => row.medication_name.toLowerCase() === name.toLowerCase())) {
      return notice("That medicine already exists.", true);
    }
    Store.insert("medicines", {
      medication_name: name,
      dosage_form: document.getElementById("medicineFormType").value.trim(),
      strength: document.getElementById("medicineStrength").value.trim(),
    });
    document.getElementById("cancelMedicine").click();
    loadMedicines();
    const addedMedicine = Store.load().medicines.find((row) => row.medication_name.toLowerCase() === name.toLowerCase());
    if (addedMedicine) document.getElementById("medicine").value = String(addedMedicine.id);
    document.getElementById("toggleMedicineForm").classList.add("hidden");
    notice("Medicine added.");
  });

  document.getElementById("prescriptionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const consultationId = document.getElementById("prescriptionConsultation").value;
    if (!consultationId) return notice("Select a consultation first.", true);
    Store.insert("prescriptions", {
      consultation_id: Number(consultationId),
      medicine_id: Number(document.getElementById("medicine").value),
      dosage: document.getElementById("dosage").value,
      frequency: document.getElementById("frequency").value,
      duration: document.getElementById("duration").value,
      instructions: document.getElementById("instructions").value,
      created_at: Store.now(),
    });
    const consultation = Store.load().consultations.find((row) => Number(row.id) === Number(consultationId));
    if (consultation) Store.update("appointments", consultation.appointment_id, { status: "completed" });
    loadAppointments();
    event.target.reset();
    loadMedicines();
    loadConsultations();
    renderPrescriptions();
    notice("Prescription created successfully.");
  });

  const renderLabs = () => {
    const data = Store.load();
    document.getElementById("labBody").innerHTML = data.labRequests.length
      ? data.labRequests.slice().reverse().map((lab) => {
          const consultation = data.consultations.find((row) => row.id === lab.consultation_id);
          return `<tr>
            <td>${esc(consultation ? Store.patientName(consultation.patient_id) : "-")}</td>
            <td>${esc(lab.category)}</td>
            <td>${esc(lab.test_name)}</td>
            <td>${esc(lab.test_result || "Pending")}</td>
            <td>${esc(lab.reference_range)}</td>
            <td>${esc(lab.remarks)}</td>
            <td>${esc(Store.formatDateTime(lab.created_at))}</td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="7">No laboratory records.</td></tr>`;
  };

  document.getElementById("labForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const consultationId = document.getElementById("labConsultation").value;
    if (!consultationId) return notice("Select a consultation first.", true);
    Store.insert("labRequests", {
      consultation_id: Number(consultationId),
      category: document.getElementById("labCategory").value,
      test_name: document.getElementById("labTestName").value,
      test_result: document.getElementById("labResult").value,
      reference_range: document.getElementById("labReference").value,
      remarks: document.getElementById("labRemarks").value,
      created_at: Store.now(),
    });
    event.target.reset();
    loadConsultations();
    renderLabs();
    notice("Laboratory request saved.");
  });

  /* ---------- Events ---------- */
  const refreshApptBtn = document.getElementById("refreshAppointments");
  if (refreshApptBtn) refreshApptBtn.addEventListener("click", loadAppointments);
  document.getElementById("doctorScheduleBody").addEventListener("click", (event) => {
    const accept = event.target.closest("[data-accept-appointment]");
    if (accept) acceptAppointment(accept.dataset.acceptAppointment);
  });
  const spb = document.getElementById("searchPatientsBtn");
  if (spb) spb.addEventListener("click", searchPatients);
  const psearch = document.getElementById("patientSearch");
  if (psearch) psearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchPatients();
  });
  document.getElementById("historyPatientSearch").addEventListener("input", () => {
    renderHistoryPatientSuggestions();
  });
  document.getElementById("historyPatientSuggestions").addEventListener("click", (event) => {
    const option = event.target.closest("[data-history-patient]");
    if (option) selectHistoryPatient(option.dataset.historyPatient);
  });
  document.getElementById("historyPatientSearch").addEventListener("keydown", (event) => {
    const options = document.querySelectorAll("#historyPatientSuggestions [data-history-patient]");
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === "Escape") {
      document.getElementById("historyPatientSuggestions").classList.add("hidden");
      event.currentTarget.setAttribute("aria-expanded", "false");
    } else if (event.key === "Enter" && options.length && !selectedHistoryPatientId) {
      event.preventDefault();
      selectHistoryPatient(options[0].dataset.historyPatient);
    }
  });
  document.getElementById("medicalHistoryForm").addEventListener("change", (event) => {
    if (event.target.name === "smokingStatus") updateSmokingPacksVisibility();
  });
  const paf = document.getElementById("patientArchiveFilter");
  if (paf) paf.addEventListener("change", searchPatients);
  document.getElementById("viewHistoryBtn").addEventListener("click", loadHistory);
  document.getElementById("generateHistoryBtn").addEventListener("click", generateHistory);

  Shared.installLogout();
  Shared.installTablePagination();

  Shared.initNav({
    titles: {
      schedule: ["Schedule", "Patients scheduled to see you today."],
      history: ["Medical History", "View stored patient medical history."],
      consultations: ["Consultation", "Create consultations and add medical notes."],
      diagnosis: ["Diagnosis", "Create diagnoses using ICD-10 codes."],
      prescription: ["Prescription", "Create prescriptions and select medicines."],
    },
    onLoad: (section) => {
      Shared.clearMessage(messageBox);
      if (section === "schedule") loadAppointments();
      if (section === "consultations") { loadConsultations(); loadAppointments(); }
      if (section === "diagnosis") {
        loadConsultations();
        setSelect("icd10", Store.load().icd10, "code", (row) => `${row.code} - ${row.description}`);
        renderDiagnoses();
      }
      if (section === "prescription") {
        loadConsultations();
        loadMedicines();
        renderPrescriptions();
      }
    },
  });

  loadAppointments();
  loadPatientsForSelects();
  loadConsultations();
})();
