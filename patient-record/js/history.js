(function () {
  const user = Shared.requireRole(["Admin", "Doctor", "Nurse", "Secretary", "Receptionist", "Nurse-Receptionist"]);
  if (!user) return;

  const esc = Shared.escapeHtml;
  const money = Shared.money;
  let filter = "all";

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    if (filter === "all") return true;
    const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
    const now = new Date();
    if (filter === "today") return d.toDateString() === now.toDateString();
    if (filter === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo && d <= now;
    }
    if (filter === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const render = () => {
    const data = Store.load();
    const rows = [];

    data.appointments.filter(a => inRange(a.appointment_date)).forEach(a => {
      rows.push({
        cat: "Appointment",
        patient: Store.patientName(a.patient_id),
        details: `Dr. ${Store.userName(a.doctor_id)} - ${a.chief_complaint || "-"}`,
        dt: `${a.appointment_date} ${a.appointment_time}`,
        extra: `Status: ${a.status} | Type: ${a.type || "-"}`
      });
    });

    data.vitalSigns.forEach(v => {
      const appt = data.appointments.find(a => a.id === v.appointment_id);
      if (!appt || !inRange(appt.appointment_date)) return;
      rows.push({
        cat: "Vital Signs",
        patient: Store.patientName(appt.patient_id),
        details: `Temp: ${v.temperature}°C, BP: ${v.blood_pressure}, HR: ${v.heart_rate} bpm, RR: ${v.respiratory_rate} rpm`,
        dt: appt.appointment_date,
        extra: `Height: ${v.height} cm, Weight: ${v.weight} kg`
      });
    });

    data.diagnoses.forEach(d => {
      const c = data.consultations.find(x => x.id === d.consultation_id);
      if (!c || !inRange(c.created_at)) return;
      rows.push({
        cat: "Diagnosis",
        patient: Store.patientName(c.patient_id),
        details: `${d.code} - ${d.diagnosis_text || "-"}`,
        dt: d.created_at,
        extra: d.lab_test ? `Lab: ${d.lab_test}` : "-"
      });
    });

    data.bills.filter(b => inRange(b.created_at)).forEach(b => {
      const t = Store.billTotals(b.id);
      rows.push({
        cat: "Bill",
        patient: Store.patientName(b.patient_id),
        details: `Bill #${b.id}`,
        dt: b.created_at,
        extra: `Total: ${money(t.total)} | Paid: ${money(t.paid)} | Balance: ${money(t.balance)} | ${t.status}`
      });
    });

    data.payments.filter(p => inRange(p.payment_date)).forEach(p => {
      const b = data.bills.find(x => x.id === p.bill_id);
      const m = data.paymentMethods.find(x => x.id === p.payment_method_id);
      rows.push({
        cat: "Payment",
        patient: b ? Store.patientName(b.patient_id) : "-",
        details: `Bill #${p.bill_id}`,
        dt: p.payment_date,
        extra: `${money(p.amount_paid)} via ${m ? m.method_name : "-"} by ${Store.userName(p.received_by)}`
      });
    });

    rows.sort((a,b) => String(b.dt).localeCompare(String(a.dt)));

    document.getElementById("histConsolidated").innerHTML = rows.length
      ? rows.map(r => `<tr><td>${esc(r.cat)}</td><td>${esc(r.patient)}</td><td>${esc(r.details)}</td><td>${esc(Store.formatDateTime(r.dt))}</td><td>${esc(r.extra)}</td></tr>`).join("")
      : '<tr><td colspan="5">No records</td></tr>';
  };

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      render();
    });
  });

  document.querySelector('[data-filter="all"]').classList.add('primary');
  Shared.installLogout();
  Shared.installTablePagination();
  render();
})();
