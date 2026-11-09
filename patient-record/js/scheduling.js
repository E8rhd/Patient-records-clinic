(function () {
  const form = document.getElementById("scheduleForm");
  const message = document.getElementById("scheduleMessage");
  const specializations = document.getElementById("specialization");
  const doctors = document.getElementById("doctor");
  const date = document.getElementById("appointmentDate");
  const times = document.getElementById("appointmentTime");
  const submitButton = form.querySelector('button[type="submit"]');
  const tomorrowISO = () => Store.tomorrowISO();
  let options;
  const prettyDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const setOptions = (select, rows, placeholder) => {
    select.replaceChildren(new Option(placeholder, ""));
    rows.forEach(({ value, label }) => select.add(new Option(label, value)));
  };

  const fail = (text) => Shared.showMessage(message, text, true);
  const clear = () => Shared.clearMessage(message);

  const loadDoctors = () => {
    clear();
    const specId = specializations.value;
    const rows = options.doctors.filter((doctor) => Number(doctor.specialization_id) === Number(specId));
    setOptions(doctors, rows.map((doctor) => ({
      value: doctor.id,
      label: `Dr. ${doctor.first_name} ${doctor.last_name}`,
    })), rows.length ? "Select doctor..." : "No doctors for this specialization");
    doctors.disabled = !rows.length;
    DateSelect.setValue("appointmentDate", tomorrowISO());
    setOptions(times, [], "Select a date first");
    times.disabled = true;
    submitButton.disabled = true;
  };

  const loadDays = () => {
    const doctorId = Number(doctors.value);
    const doctorDays = options.availability
      .filter((row) => Number(row.doctor_id) === doctorId)
      .sort((a, b) => Number(a.weekday) - Number(b.weekday));
    DateSelect.setValue("appointmentDate", tomorrowISO());
    setOptions(times, [], "Select a date first");
    const tomorrowWeekday = new Date(`${date.value}T12:00:00`).getDay() || 7;
    if (!doctorDays.some((row) => Number(row.weekday) === tomorrowWeekday)) {
      setOptions(times, [], "Doctor is not available tomorrow");
      times.disabled = true;
      submitButton.disabled = true;
      Shared.showMessage(message, "This doctor is not available tomorrow. Please choose another doctor.", true);
      return;
    }
    loadTimes();
  };

  const loadTimes = () => {
    clear();
    const chosenDate = date.value;
    if (!chosenDate) return;
    try {
      const slots = Store.availableSlots(Number(doctors.value), chosenDate);
      setOptions(times, slots.map((slot) => {
        const [hour, minute] = slot.split(":").map(Number);
        const label = new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
        return { value: slot, label };
      }), slots.length ? "Select available time..." : "No times available tomorrow");
      times.disabled = !slots.length;
      submitButton.disabled = !slots.length;
      if (!slots.length) {
        Shared.showMessage(message, "There are no available times tomorrow for this doctor. Please choose another doctor.", true);
      }
    } catch (error) {
      setOptions(times, [], "Could not load times");
      times.disabled = true;
      submitButton.disabled = true;
      fail(error.message || "Could not load available times.");
    }
  };

  specializations.addEventListener("change", loadDoctors);
  doctors.addEventListener("change", loadDays);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clear();
    if (times.disabled || !times.value) {
      Shared.showMessage(message, "Select an available appointment time before scheduling.", true);
      return;
    }
    const values = {
      first_name: document.getElementById("firstName").value.trim(),
      middle_name: document.getElementById("middleName").value.trim(),
      last_name: document.getElementById("lastName").value.trim(),
      birth_date: document.getElementById("birthDate").value,
      gender: document.getElementById("gender").value,
      contact_number: document.getElementById("contact").value.trim(),
      address: document.getElementById("address").value.trim(),
      email: document.getElementById("email").value.trim(),
      specialization_id: Number(specializations.value),
      doctor_id: Number(doctors.value),
      appointment_date: date.value,
      appointment_time: times.value,
    };
    try {
      Store.schedulePatient(values);
      form.classList.add("hidden");
      Shared.showMessage(message, "Your schedule has been submitted. The clinic has been notified.");
    } catch (error) {
      loadTimes();
      fail(error.message || "Your schedule could not be saved.");
    }
  });

  try {
    options = Store.scheduleOptions();
    setOptions(specializations, options.specializations.map((row) => ({ value: row.id, label: row.specialization_name })), "Select specialization...");
    setOptions(doctors, [], "Select specialization first");
    DateSelect.setValue("appointmentDate", tomorrowISO());
    submitButton.disabled = true;
  } catch (error) {
    fail(error.message || "Could not load the scheduling options.");
    form.querySelector("button[type=submit]").disabled = true;
  }
})();
