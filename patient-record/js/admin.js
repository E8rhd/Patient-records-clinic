(function () {
  const user = Shared.requireRole(["Admin"]);
  if (!user) return;

  const messageBox = document.getElementById("message");
  const esc = Shared.escapeHtml;

  document.getElementById("adminName").textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById("adminIdText").textContent = user.username;

  const notice = (text, error = false) => Shared.showMessage(messageBox, text, error);

  const renderUsers = () => {
    const data = Store.load();
    document.getElementById("usersBody").innerHTML = data.users
      .map((row) => {
        const role = data.roles.find((item) => Number(item.id) === Number(row.role_id));
        const isSelf = Number(row.id) === Number(user.id);
        return `<tr>
          <td>${esc(row.username)}</td>
          <td>${esc(row.first_name)} ${esc(row.last_name)}</td>
          <td>${esc(row.email)}</td>
          <td>${esc(role ? role.role_name : "")}</td>
          <td>${row.status === "active" ? "Active" : "Inactive"}</td>
          <td><button class="small-btn" data-toggle-user="${row.id}" ${isSelf && row.status === "active" ? "disabled title=\"You cannot deactivate your own account\"" : ""}>${row.status === "active" ? "Deactivate" : "Activate"}</button></td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="6">No accounts found.</td></tr>`;

    document.querySelectorAll("[data-toggle-user]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = Store.load().users.find((item) => Number(item.id) === Number(button.dataset.toggleUser));
        if (!row) return;
        Store.update("users", row.id, { status: row.status === "active" ? "inactive" : "active" });
        notice(`Account ${row.username} ${row.status === "active" ? "deactivated" : "activated"}.`);
        renderUsers();
      });
    });
  };

  const roleSelect = document.getElementById("cu-role");
  const specializationSelect = document.getElementById("cu-specialization");
  const doctorFields = document.getElementById("doctorFields");

  const fillRoleSelect = () => {
    const data = Store.load();
    roleSelect.innerHTML = data.roles
      .map((role) => `<option value="${role.id}">${esc(role.role_name)}</option>`)
      .join("");
    specializationSelect.innerHTML = data.specializations
      .map((spec) => `<option value="${spec.id}">${esc(spec.specialization_name)}</option>`)
      .join("");
  };

  roleSelect.addEventListener("change", () => {
    const selected = roleSelect.selectedOptions[0];
    doctorFields.classList.toggle("hidden", !selected || selected.textContent.trim() !== "Doctor");
  });

  document.getElementById("createAccountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Store.load();
    const username = document.getElementById("cu-username").value.trim();
    const password = document.getElementById("cu-password").value;
    const email = document.getElementById("cu-email").value.trim();
    const roleId = Number(roleSelect.value);

    if (data.users.some((row) => row.username === username)) return notice("That username is already taken.", true);
    if (data.users.some((row) => row.email === email)) return notice("That email is already registered.", true);

    Store.insert("users", {
      username,
      password,
      first_name: document.getElementById("cu-first-name").value.trim(),
      last_name: document.getElementById("cu-last-name").value.trim(),
      email,
      role_id: roleId,
      specialization_id: roleId === 2 ? Number(specializationSelect.value) || null : null,
      contact_number: roleId === 2 ? document.getElementById("cu-contact").value.trim() : "",
      status: "active",
    });

    event.target.reset();
    doctorFields.classList.add("hidden");
    fillRoleSelect();
    renderUsers();
    notice("Account created successfully.");
    document.querySelector('[data-section="users-view"]').click();
  });

  const renderRoles = () => {
    const data = Store.load();
    document.getElementById("rolesBody").innerHTML = data.roles
      .map((role) => `<tr><td>${esc(role.role_name)}</td></tr>`)
      .join("") || `<tr><td>No roles found.</td></tr>`;
  };

  document.getElementById("createRoleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("cr-role-name");
    const name = input.value.trim();
    if (!name) return notice("Please enter a role name.", true);
    Store.insert("roles", { role_name: name });
    input.value = "";
    renderRoles();
    fillRoleSelect();
    notice("Role created successfully.");
    document.querySelector('[data-section="roles-view"]').click();
  });

  const renderSpecializations = () => {
    const data = Store.load();
    document.getElementById("specializationsBody").innerHTML = data.specializations
      .map((spec) => `<tr><td>${esc(spec.specialization_name)}</td></tr>`)
      .join("") || `<tr><td>No specializations found.</td></tr>`;
  };

  document.getElementById("createSpecializationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("cs-specialization-name");
    const name = input.value.trim();
    if (!name) return notice("Please enter a specialization name.", true);
    Store.insert("specializations", { specialization_name: name });
    input.value = "";
    renderSpecializations();
    fillRoleSelect();
    notice("Specialization created successfully.");
    document.querySelector('[data-section="specializations-view"]').click();
  });

  const renderPatients = () => {
    const archived = document.getElementById("patientArchiveFilter").value === "1";
    const patients = Store.load().patients.filter((patient) =>
      archived ? Boolean(patient.archived_at) : !patient.archived_at
    );
    document.getElementById("patientsBody").innerHTML = patients
      .map((patient) => `<tr>
        <td>${esc(patient.first_name)} ${esc(patient.last_name)}</td>
        <td>${esc(patient.address)}</td>
        <td>${esc(patient.contact_number)}</td>
        <td>${esc(Store.formatDate(patient.birth_date))}</td>
        <td>
          ${archived
            ? `<button class="small-btn" data-view-patient="${patient.id}">View</button>
               <button class="small-btn" data-restore-patient="${patient.id}">Restore</button>`
            : `<button class="small-btn" data-archive-patient="${patient.id}">Archive</button>`}
        </td>
      </tr>`)
      .join("") || `<tr><td colspan="5">No patients found.</td></tr>`;

    document.querySelectorAll("#patientsBody [data-archive-patient]").forEach((button) => {
      button.addEventListener("click", () => {
        Store.update("patients", button.dataset.archivePatient, { archived_at: Store.now() });
        notice("Patient archived.");
        renderPatients();
      });
    });

    document.querySelectorAll("#patientsBody [data-restore-patient]").forEach((button) => {
      button.addEventListener("click", () => {
        Store.update("patients", button.dataset.restorePatient, { archived_at: null });
        notice("Patient restored.");
        renderPatients();
      });
    });

    document.querySelectorAll("#patientsBody [data-view-patient]").forEach((button) => {
      button.addEventListener("click", () => {
        const patient = Store.load().patients.find((item) => Number(item.id) === Number(button.dataset.viewPatient));
        if (patient) showPatientDetails(patient);
      });
    });
  };

  const showPatientDetails = (patient) => {
    let dialog = document.getElementById("patientViewDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "patientViewDialog";
      dialog.className = "patient-view-dialog";
      dialog.innerHTML = `
        <div class="patient-view-content">
          <header class="patient-view-header">
            <div><span class="patient-view-kicker">Patient archive</span><h2>Patient record</h2><p class="patient-view-name"></p></div>
            <button class="patient-view-close" type="button" aria-label="Close">&times;</button>
          </header>
          <div class="patient-view-summary"><span class="patient-view-id"></span><span class="patient-view-status"></span></div>
          <dl class="patient-view-grid"></dl>
          <footer class="patient-view-footer"><span class="patient-view-archived"></span><button class="btn" type="button">Close</button></footer>
        </div>`;
      dialog.querySelector(".patient-view-close").addEventListener("click", () => dialog.close());
      dialog.querySelector(".patient-view-footer button").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
      document.body.appendChild(dialog);
    }

    dialog.querySelector(".patient-view-name").textContent =
      [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
    dialog.querySelector(".patient-view-id").textContent = `Patient #${patient.id}`;
    dialog.querySelector(".patient-view-status").textContent = patient.status;
    dialog.querySelector(".patient-view-archived").textContent = patient.archived_at
      ? `Archived ${Store.formatDateTime(patient.archived_at)}` : "Archived record";

    const details = [
      ["Date of birth", Store.formatDate(patient.birth_date)], ["Gender", patient.gender],
      ["Contact", patient.contact_number], ["Email", patient.email, true],
      ["Address", patient.address, true],
    ];
    const grid = dialog.querySelector(".patient-view-grid");
    grid.replaceChildren();
    details.forEach(([label, value, wide]) => {
      const item = document.createElement("div");
      item.className = `patient-view-item${wide ? " patient-view-item-wide" : ""}`;
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value || "-";
      item.append(term, description);
      grid.appendChild(item);
    });
    dialog.showModal();
  };

  const renderAppointments = () => {
    const data = Store.load();
    document.getElementById("appointmentsBody").innerHTML = data.appointments
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((appointment) => `<tr>
        <td>${esc(Store.patientName(appointment.patient_id))}</td>
        <td>${esc(Store.doctorName(appointment.doctor_id))}</td>
        <td>${esc(Store.formatDate(appointment.appointment_date))}</td>
        <td>${esc(Store.formatTime(appointment.appointment_time))}</td>
        <td>${esc(appointment.status)}</td>
      </tr>`)
      .join("") || `<tr><td colspan="5">No appointments found.</td></tr>`;
  };

  document.getElementById("refreshUsers").addEventListener("click", renderUsers);
  document.getElementById("refreshPatients").addEventListener("click", renderPatients);
  document.getElementById("refreshAppointments").addEventListener("click", renderAppointments);
  document.getElementById("patientArchiveFilter").addEventListener("change", renderPatients);

  Shared.installLogout();
  Shared.installTablePagination();

  fillRoleSelect();
  Shared.initNav({
    titles: {
      "users-view": "View Accounts",
      "users-create": "Create Account",
      "roles-view": "View Roles",
      "roles-create": "Create Role",
      "specializations-view": "View Specializations",
      "specializations-create": "Create Specialization",
      "records-patients": "Patients",
      "records-appointments": "Appointments",
    },
    onLoad: (section) => {
      Shared.clearMessage(messageBox);
      if (section === "users-view") renderUsers();
      if (section === "users-create") fillRoleSelect();
      if (section === "roles-view") renderRoles();
      if (section === "specializations-view") renderSpecializations();
      if (section === "records-patients") renderPatients();
      if (section === "records-appointments") renderAppointments();
    },
  });
})();
