(function () {
  const user = Shared.requireRole(["Nurse"]);
  if (!user) return;

  document.getElementById("nurseRoleTitle").textContent = "NURSE";
  const billingNav = document.getElementById("navBilling");
  if (billingNav) billingNav.style.display = user.role_name === "Nurse-Receptionist" ? "block" : "none";

  const esc = Shared.escapeHtml;
  const messageBox = document.getElementById("message");
  let patientsCache = [];
  let appointmentsCache = [];
  let vitalsCache = [];

  document.getElementById("nurseName").textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById("userIdText").textContent = user.username;

  const notice = (text, error = false) => Shared.showMessage(messageBox, text, error);
  const emptyRow = (cols, text = "No records found.") => `<tr><td colspan="${cols}">${esc(text)}</td></tr>`;

  const formatName = (value) =>
    value.trim().toLocaleLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, separator, letter) =>
      `${separator}${letter.toLocaleUpperCase()}`
    );

  const normalizeNames = (form) => {
    form.querySelectorAll(".name-input").forEach((input) => {
      input.value = formatName(input.value);
    });
  };

  const confirmAction = (text) =>
    new Promise((resolve) => {
      messageBox.className = "message confirmation";
      messageBox.replaceChildren();
      const prompt = document.createElement("span");
      prompt.textContent = text;
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "btn danger";
      confirmButton.textContent = "Confirm";
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "btn";
      cancelButton.textContent = "Cancel";
      const finish = (value) => {
        messageBox.classList.add("hidden");
        messageBox.replaceChildren();
        resolve(value);
      };
      confirmButton.addEventListener("click", () => finish(true), { once: true });
      cancelButton.addEventListener("click", () => finish(false), { once: true });
      messageBox.append(prompt, confirmButton, cancelButton);
    });

  /* ---------- Appointments ---------- */
  const checkNotifications = () => {
    const data = Store.load();
    const notes = (data.notifications || []).filter(n => !n.read);
    if (notes.length) {
      const box = document.getElementById("nurseNotifications");
      box.textContent = notes.map(n => n.message).join(" | ");
      box.classList.remove("hidden");
      notes.forEach(n => Store.update("notifications", n.id, { read: true }));
    }
  };

  const loadAppointments = () => {
    const data = Store.load();
    appointmentsCache = data.appointments.map((appointment) => ({
      ...appointment,
      patient_name: Store.patientName(appointment.patient_id),
      doctor_name: Store.doctorName(appointment.doctor_id),
    }));
    vitalsCache = data.vitalSigns.map((vital) => {
      const appointment = data.appointments.find((row) => row.id === vital.appointment_id);
      return {
        ...vital,
        patient_id: appointment ? appointment.patient_id : null,
        patient_name: appointment ? Store.patientName(appointment.patient_id) : "Unknown",
        appointment_date: appointment ? appointment.appointment_date : "",
        appointment_status: appointment ? appointment.status : "",
        recorded_by_name: Store.userName(vital.recorded_by),
      };
    });
    renderAppointments();
    renderVitals();
    checkNotifications();
  };

  const confirmArrival = (appointmentId) => {
    Store.update("appointments", appointmentId, { status: "confirmed" });
    notice("Arrival confirmed. Patient ready for vitals/doctor.");
    loadAppointments();
  };

  const renderAppointments = () => {
    const today = Store.todayISO();
    const tomorrow = Store.tomorrowISO();
    const online = appointmentsCache.filter((appointment) => 
      [today, tomorrow].includes(String(appointment.appointment_date).slice(0, 10)) && 
      appointment.type === "appointment" &&
      appointment.status === "pending"
    );
    document.getElementById("onlineAppointmentsBody").innerHTML = online.length
      ? online.map((appointment) => `<tr>
          <td>${esc(appointment.patient_name)}</td>
          <td>${esc(appointment.doctor_name)}</td>
          <td>${esc(Store.formatDate(appointment.appointment_date))}</td>
          <td>${esc(Store.formatTime(appointment.appointment_time))}</td>
          <td>${esc(appointment.status)}</td>
          <td style="white-space: nowrap">
            <button class="small-btn" data-confirm-arrival="${appointment.id}">Confirm Arrival</button>
            <button class="small-btn" data-go-to-vitals="${appointment.id}">Vital Signs</button>
            <button class="small-btn" data-go-to-history="${appointment.patient_id}">Medical History</button>
          </td>
        </tr>`).join("")
      : emptyRow(6);

    setAppointmentSelect();
  };

  const goToVitals = (appointmentId) => {
    const appointment = appointmentsCache.find((row) => String(row.id) === String(appointmentId));
    if (!appointment) return;
    document.querySelector('[data-section="vitals"]').click();
    const existing = vitalsCache.find((vital) => String(vital.patient_id) === String(appointment.patient_id));
    if (existing) {
      selectVital(existing.id);
      notice(`${appointment.patient_name} already has a vital-sign record. You can update it here.`);
    } else {
      clearVitalsForm();
      document.getElementById("vitalAppointment").value = appointment.id;
      document.getElementById("temperature").focus();
    }
  };

  const goToHistory = (patientId) => {
    document.querySelector('[data-section="history"]').click();
    const select = document.getElementById("historyPatient");
    select.value = String(patientId);
    if (select.value) loadHistory();
  };

  const setAppointmentSelect = () => {
    const select = document.getElementById("vitalAppointment");
    const current = select.value;
    const editingId = Number(document.getElementById("vitalId").value);
    const editingVital = vitalsCache.find((vital) => Number(vital.id) === editingId);
    const editingPatientId = editingVital ? String(editingVital.patient_id) : null;
    const today = Store.todayISO();

    select.innerHTML = `<option value="">Select appointment...</option>`;
    appointmentsCache
      .filter((appointment) =>
        (String(appointment.appointment_date).slice(0, 10) === today || String(appointment.id) === current) &&
        (!vitalsCache.some((vital) => String(vital.patient_id) === String(appointment.patient_id)) ||
          String(appointment.patient_id) === editingPatientId)
      )
      .forEach((appointment) => {
        const option = document.createElement("option");
        option.value = appointment.id;
        option.textContent = `${appointment.patient_name} - ${Store.formatDate(appointment.appointment_date)}`;
        select.appendChild(option);
      });
    if (current) select.value = current;
  };

  /* ---------- Patients ---------- */
  const loadPatients = () => {
    const search = document.getElementById("patientSearch").value.trim().toLowerCase();
    const archived = document.getElementById("patientArchiveFilter").value === "1";
    patientsCache = Store.load().patients.filter((patient) => {
      if (archived ? !patient.archived_at : patient.archived_at) return false;
      if (!search) return true;
      return `${patient.first_name} ${patient.middle_name} ${patient.last_name} ${patient.id}`.toLowerCase().includes(search);
    });

    document.getElementById("patientsBody").innerHTML = patientsCache.length
      ? patientsCache.map((patient) => `<tr data-row-patient="${patient.id}" style="cursor:pointer">
          <td>${esc(patient.first_name)} ${esc(patient.middle_name)} ${esc(patient.last_name)}</td>
          <td>${esc(patient.gender)}</td>
          <td>${esc(Store.formatDate(patient.birth_date))}</td>
          <td>${esc(patient.contact_number)}</td>
          <td>${esc(patient.status)}</td>
          <td style="white-space: nowrap">
            ${archived
              ? `<button class="small-btn" data-restore-patient="${patient.id}">Restore</button>`
              : `<button class="small-btn" data-select-patient="${patient.id}">Edit</button>`}
          </td>
        </tr>`).join("")
      : emptyRow(6);
  };

  const openRegisterPatientModal = () => {
    document.getElementById("registerPatientModal").classList.remove("hidden");
    document.getElementById("registerFirstName").focus();
  };

  const closeRegisterPatientModal = () => {
    document.getElementById("registerPatientModal").classList.add("hidden");
    document.getElementById("registerPatientForm").reset();
  };

  document.getElementById("registerPatientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    normalizeNames(event.currentTarget);
    const data = {
      first_name: document.getElementById("registerFirstName").value.trim(),
      middle_name: document.getElementById("registerMiddleName").value.trim(),
      last_name: document.getElementById("registerLastName").value.trim(),
      birth_date: document.getElementById("registerBirthDate").value,
      gender: document.getElementById("registerGender").value,
      address: document.getElementById("registerAddress").value.trim(),
      contact_number: document.getElementById("registerContact").value.trim(),
      email: document.getElementById("registerEmail").value.trim(),
    };
    if (!data.first_name || !data.last_name || !data.birth_date || !data.gender) {
      return notice("Please complete all required patient fields.", true);
    }

    const patient = Store.insert("patients", {
      ...data,
      status: "active",
      archived_at: null,
      created_at: Store.now(),
    });

    const emergencyName = document.getElementById("registerEmergencyName").value.trim();
    const emergencyRelationship = document.getElementById("registerEmergencyRelationship").value.trim();
    const emergencyContact = document.getElementById("registerEmergencyContact").value.trim();
    if (emergencyName || emergencyRelationship || emergencyContact) {
      Store.insert("emergencyContacts", {
        patient_id: patient.id,
        full_name: emergencyName,
        relationship: emergencyRelationship,
        contact_number: emergencyContact,
      });
    }

    closeRegisterPatientModal();
    notice(`Patient registered successfully. Patient ID: ${patient.id}`);
    loadPatients();
  });

  const selectPatient = (id) => {
    const patient = Store.load().patients.find((row) => Number(row.id) === Number(id));
    if (!patient) return;
    document.getElementById("patientId").value = patient.id;
    document.getElementById("patientFirstName").value = patient.first_name || "";
    document.getElementById("patientMiddleName").value = patient.middle_name || "";
    document.getElementById("patientLastName").value = patient.last_name || "";
    DateSelect.setValue("patientBirthDate", patient.birth_date || "");
    document.getElementById("patientGender").value = patient.gender || "";
    document.getElementById("patientContact").value = patient.contact_number || "";
    document.getElementById("patientEmail").value = patient.email || "";
    document.getElementById("patientAddress").value = patient.address || "";
    document.getElementById("patientStatus").value = patient.status || "active";
    document.getElementById("archivePatientButton").disabled = Boolean(patient.archived_at);
  };

  const clearPatientForm = () => {
    document.getElementById("patientForm").reset();
    document.getElementById("patientId").value = "";
    document.getElementById("archivePatientButton").disabled = false;
  };

  document.getElementById("patientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    normalizeNames(event.currentTarget);
    const patientId = document.getElementById("patientId").value;
    if (!patientId) { notice("Select a patient first.", true); return; }
    Store.update("patients", patientId, {
      first_name: document.getElementById("patientFirstName").value.trim(),
      middle_name: document.getElementById("patientMiddleName").value.trim(),
      last_name: document.getElementById("patientLastName").value.trim(),
      birth_date: document.getElementById("patientBirthDate").value,
      gender: document.getElementById("patientGender").value,
      address: document.getElementById("patientAddress").value.trim(),
      contact_number: document.getElementById("patientContact").value.trim(),
      email: document.getElementById("patientEmail").value.trim(),
      status: document.getElementById("patientStatus").value,
    });
    notice("Patient updated successfully.");
    loadPatients();
    loadAppointments();
    loadHistoryPatients();
  });

  const setPatientArchived = (patientId, archived) => {
    Store.update("patients", patientId, { archived_at: archived ? Store.now() : null });
    if (archived && document.getElementById("patientId").value === String(patientId)) clearPatientForm();
    document.getElementById("patientArchiveFilter").value = archived ? "1" : "0";
    notice(archived ? "Patient archived successfully." : "Patient restored successfully.");
    loadPatients();
    loadHistoryPatients();
    loadAppointments();
  };

  /* ---------- Vitals ---------- */
  const getFilteredVitals = () => {
    const from = document.getElementById("vitalDateFrom").value;
    const to = document.getElementById("vitalDateTo").value;
    return vitalsCache.filter((vital) => {
      const date = String(vital.appointment_date || "").slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  };

  function isSentToDoctor(vital) {
    return String(vital.appointment_status || "").toLowerCase() !== "pending";
  }

  const renderVitals = () => {
    const rows = getFilteredVitals();
    document.getElementById("vitalsBody").innerHTML = rows.length
      ? rows.map((vital) => `<tr>
          <td>${esc(vital.patient_name)}</td>
          <td>${esc(Store.formatDate(vital.appointment_date))}</td>
          <td>${esc(vital.temperature)}</td>
          <td>${esc(vital.blood_pressure)}</td>
          <td>${esc(vital.heart_rate)}</td>
          <td>${esc(vital.respiratory_rate)}</td>
          <td>${esc(vital.height)}</td>
          <td>${esc(vital.weight)}</td>
          <td>${esc(vital.recorded_by_name)}</td>
          <td style="white-space: nowrap">
            <button class="small-btn" data-select-vital="${vital.id}">Edit</button>
            <button class="small-btn" data-confirm-vitals="${vital.id}" ${isSentToDoctor(vital) ? "disabled" : ""}>${isSentToDoctor(vital) ? "Sent to Doctor" : "Confirm"}</button>
            <button class="small-btn" style="color: var(--accent)" data-delete-vital-row="${vital.id}">Delete</button>
          </td>
        </tr>`).join("")
      : emptyRow(10);
  };

  const confirmVitals = async (id) => {
    const vital = vitalsCache.find((row) => Number(row.id) === Number(id));
    if (!vital) return;
    if (!(await confirmAction(`Confirm that ${vital.patient_name} is done being vital signed and send to the Doctor's Dashboard?`))) return;

    Store.update("appointments", vital.appointment_id, { status: "confirmed" });
    const appointment = Store.load().appointments.find((row) => row.id === vital.appointment_id);
    notice(`Vital signs confirmed. ${vital.patient_name} is now sent to ${Store.doctorName(appointment.doctor_id)}.`);
    loadAppointments();
  };

  const selectVital = (id) => {
    const vital = vitalsCache.find((row) => Number(row.id) === Number(id));
    if (!vital) return;
    document.getElementById("vitalId").value = vital.id;
    setAppointmentSelect();
    document.getElementById("vitalAppointment").value = vital.appointment_id;
    document.getElementById("temperature").value = vital.temperature ?? "";
    document.getElementById("bloodPressure").value = vital.blood_pressure || "";
    document.getElementById("heartRate").value = vital.heart_rate ?? "";
    document.getElementById("respiratoryRate").value = vital.respiratory_rate ?? "";
    document.getElementById("height").value = vital.height ?? "";
    document.getElementById("weight").value = vital.weight ?? "";
  };

  function clearVitalsForm() {
    document.getElementById("vitalsForm").reset();
    document.getElementById("vitalId").value = "";
    setAppointmentSelect();
  }

  document.getElementById("vitalsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const vitalId = document.getElementById("vitalId").value;
    const appointmentId = document.getElementById("vitalAppointment").value;
    if (!appointmentId) return notice("Select an appointment first.", true);

    const payload = {
      appointment_id: Number(appointmentId),
      temperature: document.getElementById("temperature").value,
      blood_pressure: document.getElementById("bloodPressure").value,
      heart_rate: document.getElementById("heartRate").value,
      respiratory_rate: document.getElementById("respiratoryRate").value,
      height: document.getElementById("height").value,
      weight: document.getElementById("weight").value,
      recorded_by: user.id,
    };

    if (vitalId) {
      Store.update("vitalSigns", vitalId, payload);
      notice("Vital signs updated successfully.");
    } else {
      Store.insert("vitalSigns", { ...payload, created_at: Store.now() });
      notice("Vital signs saved successfully.");
    }

    clearVitalsForm();
    loadAppointments();
  });

  const deleteVitalsBtn = document.getElementById("deleteVitals");
  if (deleteVitalsBtn) deleteVitalsBtn.style.display = "none";

  /* ---------- History ---------- */
  const loadHistoryPatients = (filter = "") => {
    const select = document.getElementById("historyPatient");
    const current = select.value;
    const q = filter.toLowerCase();
    const patients = Store.load().patients.filter(p => {
      if (!q) return true;
      return `${p.first_name} ${p.middle_name} ${p.last_name} ${p.id}`.toLowerCase().includes(q);
    });
    select.innerHTML = `<option value="">Select patient...</option>` + patients
      .map((patient) => `<option value="${patient.id}">${esc(patient.first_name)} ${esc(patient.last_name)}</option>`)
      .join("");
    if (current && patients.some(p => String(p.id) === current)) select.value = current;
  };

  document.getElementById("historySearch").addEventListener("input", (e) => {
    loadHistoryPatients(e.target.value);
  });

  const loadHistory = () => {
    const patientId = document.getElementById("historyPatient").value;
    if (!patientId) return notice("Select a patient first.", true);
    const data = Store.load();
    const patient = data.patients.find((row) => Number(row.id) === Number(patientId));
    const history = data.medicalHistory.find((row) => Number(row.patient_id) === Number(patientId));
    const emergency = data.emergencyContacts.find((row) => Number(row.patient_id) === Number(patientId));
    const appointments = data.appointments.filter((row) => Number(row.patient_id) === Number(patientId));
    const consultations = data.consultations.filter((row) => Number(row.patient_id) === Number(patientId));
    const diagnoses = data.diagnoses;

    const name = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
    const consultItems = consultations.map((visit) => {
      const visitDiagnoses = diagnoses
        .filter((row) => row.consultation_id === visit.id)
        .map((row) => `${row.code} - ${row.diagnosis_text}`)
        .join("; ");
      return `<li>#${visit.id} - ${esc(Store.formatDateTime(visit.created_at))} - ${esc(Store.doctorName(visit.doctor_id))}
        <div>${esc(visit.notes || "No consultation notes")}</div>
        ${visit.findings ? `<div>Findings: ${esc(visit.findings)}</div>` : ""}
        ${visit.plan ? `<div>Plan: ${esc(visit.plan)}</div>` : ""}
        <div>Diagnosis: ${esc(visitDiagnoses || "None recorded")}</div>
      </li>`;
    }).join("");

    document.getElementById("historyResult").innerHTML = `
      <div class="record-item"><span>Patient</span>${esc(name)}</div>
      <div class="record-item"><span>Sex</span>${esc(patient.gender || "-")}</div>
      <div class="record-item"><span>Birth Date</span>${esc(Store.formatDate(patient.birth_date))}</div>
      <div class="record-item"><span>Contact</span>${esc(patient.contact_number || "-")}</div>
      <div class="record-item"><span>Address</span>${esc(patient.address || "-")}</div>
      <div class="record-item"><span>Emergency Contact</span>${esc(emergency ? `${emergency.full_name} (${emergency.relationship})` : "-")}</div>
      <div class="record-item"><span>Emergency Number</span>${esc(emergency ? emergency.contact_number : "-")}</div>
      <div class="record-item"><span>Allergies</span>${esc(history ? Shared.formatChoices(history.allergies) : "Not recorded")}</div>
      <div class="record-item"><span>Personal History</span>${esc(history ? Shared.formatChoices(history.chronic_conditions) : "Not recorded")}</div>
      <div class="record-item"><span>Past Surgeries</span>${esc(history ? history.past_surgeries || "-" : "-")}</div>
      <div class="record-item"><span>Medications</span>${esc(history ? Shared.formatMedications(history.medications) : "Not recorded").replaceAll("\n", "<br>")}</div>
      <div class="record-item"><span>Family History</span>${esc(history ? Shared.formatChoices(history.family_history) : "Not recorded")}</div>
      <div class="record-item full"><span>Appointments (${appointments.length})</span>
        ${appointments.length ? `<ul>${appointments.map((appointment) => `<li>#${appointment.id} - ${esc(Store.formatDate(appointment.appointment_date))} ${esc(Store.formatTime(appointment.appointment_time))} - ${esc(appointment.status)} - ${esc(appointment.chief_complaint || "No complaint")}</li>`).join("")}</ul>` : "No appointments found."}
      </div>
      <div class="record-item full"><span>Consultation and Diagnosis History (${consultations.length})</span>
        ${consultations.length ? `<ul>${consultItems}</ul>` : "No consultations or diagnoses recorded."}
      </div>`;
  };

  /* ---------- Events ---------- */
  document.getElementById("refreshAppointments").addEventListener("click", loadAppointments);

  document.getElementById("searchPatientsBtn").addEventListener("click", loadPatients);
  document.getElementById("patientSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadPatients();
  });
  document.getElementById("openRegisterPatient").addEventListener("click", openRegisterPatientModal);
  document.getElementById("closeRegisterPatient").addEventListener("click", closeRegisterPatientModal);
  document.getElementById("cancelRegisterPatient").addEventListener("click", closeRegisterPatientModal);
  document.getElementById("registerPatientModal").addEventListener("click", (event) => {
    if (event.target.id === "registerPatientModal") closeRegisterPatientModal();
  });
  const clearPatientBtn = document.getElementById("clearPatient");
  if (clearPatientBtn) clearPatientBtn.style.display = "none";
  document.getElementById("archivePatientButton").addEventListener("click", async () => {
    const patientId = document.getElementById("patientId").value;
    if (!patientId) return notice("Select a patient first.", true);
    if (!(await confirmAction("Archive this patient?"))) return;
    setPatientArchived(patientId, true);
  });
  document.getElementById("patientArchiveFilter").addEventListener("change", loadPatients);

  document.getElementById("refreshVitals").addEventListener("click", loadAppointments);
  document.getElementById("clearVitals").addEventListener("click", clearVitalsForm);
  document.getElementById("vitalDateFrom").addEventListener("change", renderVitals);
  document.getElementById("vitalDateTo").addEventListener("change", renderVitals);
  document.getElementById("clearVitalFilter").addEventListener("click", () => {
    DateSelect.clear("vitalDateFrom");
    DateSelect.clear("vitalDateTo");
    renderVitals();
  });

  document.getElementById("vitalsBody").addEventListener("click", async (event) => {
    const confirmButton = event.target.closest("[data-confirm-vitals]");
    const updateButton = event.target.closest("[data-select-vital]");
    const deleteButton = event.target.closest("[data-delete-vital-row]");
    if (confirmButton) confirmVitals(confirmButton.dataset.confirmVitals);
    if (updateButton) selectVital(updateButton.dataset.selectVital);
    if (deleteButton) {
      if (!(await confirmAction("Delete this vital-sign record?"))) return;
      Store.remove("vitalSigns", deleteButton.dataset.deleteVitalRow);
      notice("Vital signs deleted successfully.");
      clearVitalsForm();
      loadAppointments();
    }
  });

  document.getElementById("onlineAppointmentsBody").addEventListener("click", (event) => {
    const vitalsButton = event.target.closest("[data-go-to-vitals]");
    const historyButton = event.target.closest("[data-go-to-history]");
    const confirmArrivalBtn = event.target.closest("[data-confirm-arrival]");
    if (vitalsButton) goToVitals(vitalsButton.dataset.goToVitals);
    if (historyButton) goToHistory(historyButton.dataset.goToHistory);
    if (confirmArrivalBtn) confirmArrival(confirmArrivalBtn.dataset.confirmArrival);
  });

  document.getElementById("patientsBody").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) {
      if (button.dataset.selectPatient) { selectPatient(button.dataset.selectPatient); return; }
      if (button.dataset.restorePatient) { setPatientArchived(button.dataset.restorePatient, false); return; }
      return;
    }
    const row = event.target.closest("[data-row-patient]");
    if (row) {
      const pid = row.dataset.rowPatient;
      const archived = document.getElementById("patientArchiveFilter").value === "1";
      if (!archived) selectPatient(pid);
    }
  });

  document.getElementById("loadHistory").addEventListener("click", loadHistory);

  Shared.installLogout();
  Shared.installTablePagination();

  Shared.initNav({
    titles: {
      appointments: ["Schedule", "Pending online schedules and walk-ins."],
      patients: ["Patients", "Register, retrieve, update patient records."],
      vitals: ["Vital Signs", "Record and manage vital signs."],
      history: ["Medical History", "Search and view medical history."],
    },
    onLoad: (section) => {
      Shared.clearMessage(messageBox);
      if (section === "appointments") loadAppointments();
      if (section === "patients") loadPatients();
      if (section === "vitals") loadAppointments();
      if (section === "history") loadHistoryPatients();
    },
  });

  loadAppointments();
  loadPatients();
  loadHistoryPatients();
  window.setInterval(() => {
    try {
      loadAppointments();
    } catch (error) {
      notice(error.message || "Could not refresh appointments.", true);
    }
  }, 30000);
})();
