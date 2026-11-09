(function () {
  const user = Shared.requireRole(["Receptionist", "Secretary"]);
  if (!user) return;

  const messageBox = document.getElementById("message");
  document.getElementById("billingName").textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById("userIdText").textContent = user.username;

  const loadStats = () => {
    const data = Store.load();
    const today = Store.todayISO();
    const todayPayments = data.payments.filter((p) => String(p.payment_date).startsWith(today));
    const revenue = todayPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

    let unpaidTotal = 0;
    data.bills.forEach((bill) => {
      const totals = Store.billTotals(bill.id);
      if (totals.status !== "Paid") unpaidTotal += totals.balance;
    });

    const methods = data.paymentMethods.filter((m) => m.is_active).length;

    document.getElementById("statRevenue").textContent = Shared.money(revenue);
    document.getElementById("statUnpaid").textContent = Shared.money(unpaidTotal);
    document.getElementById("statMethods").textContent = methods;
  };

  Shared.installLogout();
  Shared.installTablePagination();
  BillingPanel.mount(document.getElementById("staffBillingRoot"));
  loadStats();
  const observer = new MutationObserver(loadStats);
  observer.observe(document.getElementById("staffBillingRoot"), { childList: true, subtree: true });
})();
