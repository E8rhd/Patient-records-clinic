window.BillingPanel = (() => {
  const esc = Shared.escapeHtml;
  const money = Shared.money;
  const state = { root: null, cart: [] };

  const renderShell = (root) => {
    root.innerHTML = `
      <div id="staffBillingMessage" class="message hidden" role="status"></div>
      <div class="staff-billing-grid">
        <section class="card">
          <div class="card-head"><div><h2>Services</h2><p>Add clinic services and prices.</p></div></div>
          <form id="staffServiceForm" class="staff-billing-form staff-service-form">
            <label>Service name<input name="service_name" required maxlength="120"></label>
            <label>Category
              <select name="category_choice" required></select>
              <input class="staff-category-custom hidden" name="category_custom" maxlength="50" placeholder="New category name" aria-label="New category name">
            </label>
            <label>Base price<input name="base_price" type="number" min="0" step="0.01" required></label>
            <button class="btn primary" type="submit">Add service</button>
          </form>
          <div class="table-wrap"><table><thead><tr><th>Service</th><th>Category</th><th>Price</th></tr></thead><tbody id="staffServicesBody"></tbody></table></div>
        </section>
        <section id="staffCreateBillCard" class="card">
          <div class="card-head"><div><h2>Create bill</h2><p>Build a bill from clinic services.</p></div></div>
          <form id="staffBillForm" class="staff-billing-form">
            <label class="full">Patient<select name="patient_id" required></select></label>
            <label>Service<select name="service_id" required></select></label>
            <label>Quantity<input name="quantity" type="number" min="1" max="1000" value="1" required></label>
            <button class="btn" id="staffAddBillItem" type="button">Add item</button>
            <div class="staff-bill-cart full" id="staffBillCart"></div>
            <button class="btn primary" type="submit">Create bill</button>
          </form>
        </section>
        <section class="card full">
          <div class="card-head"><div><h2>Bills</h2><p>Outstanding balances and payment status.</p></div><button class="btn" id="staffBillingRefresh" type="button">Refresh</button></div>
          <div class="table-wrap"><table><thead><tr><th>Bill</th><th>Patient</th><th>Services</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody id="staffBillsBody"></tbody></table></div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Collect payment</h2><p>Record a partial or full payment.</p></div></div>
          <form id="staffPaymentForm" class="staff-billing-form">
            <label class="full">Bill<select name="bill_id" required></select></label>
            <label class="full">Payment method<select name="payment_method_id" required></select></label>
            <label>Amount<input name="amount_paid" type="number" min="0.01" step="0.01" required></label>
            <button class="btn primary" type="submit">Record payment</button>
          </form>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Transactions</h2><p>Recent payments recorded by staff.</p></div></div>
          <div class="table-wrap"><table><thead><tr><th>Bill</th><th>Patient</th><th>Method</th><th>Amount</th><th>Received by</th><th>Date</th></tr></thead><tbody id="staffTransactionsBody"></tbody></table></div>
        </section>
      </div>`;
  };

  const message = (text, error = false) => {
    const box = state.root.querySelector("#staffBillingMessage");
    if (!box) return;
    box.textContent = text;
    box.className = `message${error ? " error" : ""}`;
    box.classList.remove("hidden");
  };

  const getData = () => {
    const data = Store.load();
    const patients = data.patients.map((p) => ({ patient_id: p.id, patient_name: Store.patientName(p.id) }));
    const services = data.services.map((s) => ({ service_id: s.id, service_name: s.service_name, service_category: s.service_category, base_price: s.base_price }));
    const categories = data.serviceCategories.map((c) => ({ category_name: c.category_name }));
    const methods = data.paymentMethods.filter((m) => m.is_active).map((m) => ({ payment_method_id: m.id, method_name: m.method_name }));

    const bills = data.bills.map((bill) => {
      const totals = Store.billTotals(bill.id);
      const items = data.billItems.filter((bi) => bi.bill_id === bill.id).map((bi) => {
        const svc = data.services.find((s) => s.id === bi.service_id);
        return svc ? `${svc.service_name} x${bi.quantity}` : "";
      }).filter(Boolean).join(", ");
      return {
        bill_id: bill.id,
        patient_id: bill.patient_id,
        patient_name: Store.patientName(bill.patient_id),
        items,
        total_amount: totals.total,
        total_paid: totals.paid,
        balance: totals.balance,
        status: bill.status,
      };
    });

    const transactions = data.payments.map((p) => {
      const method = data.paymentMethods.find((m) => m.id === p.payment_method_id);
      return {
        bill_id: p.bill_id,
        patient_name: Store.patientName(data.bills.find((b) => b.id === p.bill_id)?.patient_id),
        method_name: method ? method.method_name : "",
        amount_paid: p.amount_paid,
        received_by_name: Store.userName(p.received_by),
        payment_date: p.payment_date,
      };
    });

    return { patients, services, categories, methods, bills, transactions };
  };

  const renderCart = () => {
    const cart = state.root.querySelector("#staffBillCart");
    if (!cart) return;
    const data = Store.load();
    const rows = state.cart.map((item, index) => {
      const service = data.services.find((entry) => entry.id === item.service_id);
      return `<div class="staff-cart-row"><span>${esc(service?.service_name)} × ${item.quantity}</span><strong>${money(Number(service?.base_price || 0) * item.quantity)}</strong><button class="small-btn" type="button" data-remove-item="${index}" aria-label="Remove ${esc(service?.service_name)}">Remove</button></div>`;
    });
    const total = state.cart.reduce((sum, item) => {
      const service = data.services.find((entry) => entry.id === item.service_id);
      return sum + Number(service?.base_price || 0) * item.quantity;
    }, 0);
    cart.innerHTML = rows.length
      ? `${rows.join("")}<div class="staff-cart-total"><span>Bill total</span><strong>${money(total)}</strong></div>`
      : '<p class="muted">Add services to build this bill.</p>';
  };

  const updatePaymentLimit = () => {
    const form = state.root.querySelector("#staffPaymentForm");
    const data = getData();
    const bill = data.bills.find((item) => item.bill_id == form.elements.bill_id.value);
    const amount = form.elements.amount_paid;
    if (!bill || Number(bill.balance) <= 0) {
      amount.disabled = true;
      amount.value = "";
      amount.removeAttribute("max");
      return;
    }
    amount.disabled = false;
    amount.max = Number(bill.balance).toFixed(2);
    amount.value = Number(bill.balance).toFixed(2);
  };

  const render = () => {
    const { patients, services, categories, methods, bills, transactions } = getData();
    const root = state.root;
    const categorySelect = root.querySelector('#staffServiceForm [name="category_choice"]');
    categorySelect.innerHTML = `<option value="">Select category...</option>${categories.map((item) => `<option value="${esc(item.category_name)}">${esc(item.category_name)}</option>`).join("")}<option value="__new">Add new category...</option>`;

    root.querySelector('#staffBillForm [name="patient_id"]').innerHTML = `<option value="">Select patient...</option>${patients.map((patient) => `<option value="${patient.patient_id}">${esc(patient.patient_name)}</option>`).join("")}`;
    root.querySelector('#staffBillForm [name="service_id"]').innerHTML = `<option value="">Select service...</option>${services.map((service) => `<option value="${service.service_id}">${esc(service.service_name)} · ${money(service.base_price)}</option>`).join("")}`;
    root.querySelector('#staffPaymentForm [name="payment_method_id"]').innerHTML = `<option value="">Select method...</option>${methods.map((method) => `<option value="${method.payment_method_id}">${esc(method.method_name)}</option>`).join("")}`;
    root.querySelector('#staffPaymentForm [name="bill_id"]').innerHTML = `<option value="">Select outstanding bill...</option>${bills.filter((bill) => Number(bill.balance) > 0).map((bill) => `<option value="${bill.bill_id}">#${bill.bill_id} · ${esc(bill.patient_name)} · ${money(bill.balance)}</option>`).join("")}`;

    root.querySelector("#staffServicesBody").innerHTML = services.length
      ? services.map((service) => `<tr><td>${esc(service.service_name)}</td><td>${esc(service.service_category || "Uncategorized")}</td><td>${money(service.base_price)}</td></tr>`).join("")
      : '<tr><td colspan="3">No services yet.</td></tr>';
    root.querySelector("#staffBillsBody").innerHTML = bills.length
      ? bills.map((bill) => `<tr><td>#${bill.bill_id}</td><td>${esc(bill.patient_name)}</td><td>${esc(bill.items || "No line items")}</td><td>${money(bill.total_amount)}</td><td>${money(bill.total_paid)}</td><td>${money(bill.balance)}</td><td>${esc(bill.status)}</td><td>${Number(bill.balance) > 0 ? `<button class="small-btn" type="button" data-select-bill="${bill.bill_id}">Collect</button>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="8">No bills yet.</td></tr>';
    root.querySelector("#staffTransactionsBody").innerHTML = transactions.length
      ? transactions.map((transaction) => `<tr><td>#${transaction.bill_id}</td><td>${esc(transaction.patient_name)}</td><td>${esc(transaction.method_name)}</td><td>${money(transaction.amount_paid)}</td><td>${esc(transaction.received_by_name)}</td><td>${esc(Store.formatDateTime(transaction.payment_date))}</td></tr>`).join("")
      : '<tr><td colspan="6">No transactions yet.</td></tr>';
    renderCart();
    updatePaymentLimit();
  };

  const bind = () => {
    const root = state.root;
    root.addEventListener("change", (event) => {
      if (event.target.name === "category_choice") {
        const custom = root.querySelector('[name="category_custom"]');
        const isCustom = event.target.value === "__new";
        custom.classList.toggle("hidden", !isCustom);
        custom.required = isCustom;
        if (!isCustom) custom.value = "";
      }
      if (event.target.name === "bill_id") updatePaymentLimit();
    });

    root.addEventListener("click", (event) => {
      if (event.target.id === "staffBillingRefresh") { render(); Shared.clearMessage(root.querySelector("#staffBillingMessage")); return; }
      if (event.target.id === "staffAddBillItem") {
        const form = root.querySelector("#staffBillForm");
        const serviceId = Number(form.elements.service_id.value);
        const quantity = Number(form.elements.quantity.value);
        const service = Store.load().services.find((item) => item.id === serviceId);
        if (!service || !Number.isInteger(quantity) || quantity < 1) {
          message("Choose a service and valid quantity.", true);
          return;
        }
        state.cart.push({ service_id: serviceId, quantity });
        form.elements.quantity.value = "1";
        renderCart();
        return;
      }
      const selectBill = event.target.closest("[data-select-bill]");
      if (selectBill) {
        const select = root.querySelector('#staffPaymentForm [name="bill_id"]');
        select.value = selectBill.dataset.selectBill;
        updatePaymentLimit();
        root.querySelector("#staffPaymentForm").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const removeItem = event.target.closest("[data-remove-item]");
      if (removeItem) {
        state.cart.splice(Number(removeItem.dataset.removeItem), 1);
        renderCart();
        return;
      }
    });

    root.addEventListener("submit", (event) => {
      if (!["staffServiceForm", "staffBillForm", "staffPaymentForm"].includes(event.target.id)) return;
      event.preventDefault();
      const form = event.target;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const user = Shared.currentUser();
        if (form.id === "staffServiceForm") {
          const categoryChoice = form.elements.category_choice.value;
          const category = categoryChoice === "__new" ? form.elements.category_custom.value.trim() : categoryChoice;
          if (!category) throw new Error("Select or enter a category.");
          const data = Store.load();
          let cat = data.serviceCategories.find((c) => c.category_name.toLowerCase() === category.toLowerCase());
          if (!cat && categoryChoice === "__new") {
            cat = Store.insert("serviceCategories", { category_name: category });
          }
          Store.insert("services", {
            service_name: form.elements.service_name.value.trim(),
            service_category: cat ? cat.category_name : category,
            base_price: Number(form.elements.base_price.value),
          });
          form.reset();
          form.elements.category_custom.classList.add("hidden");
          form.elements.category_custom.required = false;
          message("Service added.");
        } else if (form.id === "staffBillForm") {
          if (!state.cart.length) throw new Error("Add at least one service to the bill.");
          const bill = Store.insert("bills", {
            patient_id: Number(form.elements.patient_id.value),
            status: "Unpaid",
            created_at: Store.now(),
          });
          state.cart.forEach((item) => {
            Store.insert("billItems", {
              bill_id: bill.id,
              service_id: Number(item.service_id),
              quantity: Number(item.quantity || 1),
              amount: Number(Store.load().services.find((s) => s.id === Number(item.service_id))?.base_price || 0),
            });
          });
          Store.refreshBillStatus(bill.id);
          state.cart = [];
          form.reset();
          renderCart();
          message(`Bill #${bill.id} created.`);
        } else if (form.id === "staffPaymentForm") {
          const billId = Number(form.elements.bill_id.value);
          const amountPaid = Number(form.elements.amount_paid.value);
          if (!billId || !amountPaid) throw new Error("Select bill and amount.");
          Store.insert("payments", {
            bill_id: billId,
            amount_paid: amountPaid,
            payment_method_id: Number(form.elements.payment_method_id.value),
            received_by: user ? user.id : null,
            payment_date: Store.now(),
          });
          const bill = Store.refreshBillStatus(billId);
          message(`Payment recorded. Bill status: ${bill ? bill.status : ""}.`);
          form.elements.amount_paid.value = "";
        }
        render();
      } catch (error) {
        message(error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  };

  return {
    mount(rootEl) {
      if (!rootEl) return;
      state.root = rootEl;
      renderShell(rootEl);
      rootEl.classList.add("staff-bill-create-only");
      bind();
      render();
    },
    refresh() {
      if (state.root) {
        Shared.clearMessage(state.root.querySelector("#staffBillingMessage"));
        render();
      }
    }
  };
})();
