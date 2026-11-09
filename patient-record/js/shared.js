/* Shared UI helpers: auth guard, navigation, logout dialog, pagination */
window.Shared = (() => {
  const PAGE_SIZE = 10;

  function currentUser() {
    try {
      return JSON.parse(sessionStorage.getItem("currentUser") || "null");
    } catch (e) {
      return null;
    }
  }

  function requireRole(roles, loginPath = "login") {
    const user = currentUser();
    if (!user || !user.id) {
      window.location.href = loginPath;
      return null;
    }
    if (roles && !roles.includes(user.role_name)) {
      window.location.href = dashboardFor(user.role_name);
      return null;
    }
    return user;
  }

  function dashboardFor(roleName) {
    const role = String(roleName || "").toLowerCase();
    switch (role) {
      case "doctor": return "doctor.html";
      case "nurse": return "nurse.html";
      default: return "admin.html";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function showMessage(el, text, error = false) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
    el.classList.toggle("error", Boolean(error));
  }

  function clearMessage(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("error");
  }

  function initNav({ titles = {}, onLoad } = {}) {
    const buttons = Array.from(document.querySelectorAll("[data-section]"));
    const sections = Array.from(document.querySelectorAll(".content-section"));
    const titleEl = document.getElementById("pageTitle") || document.getElementById("section-title");

    const activate = (name) => {
      sections.forEach((section) => section.classList.toggle("d-none", section.id !== name));
      buttons.forEach((button) => {
        const active = button.dataset.section === name;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      if (titleEl) titleEl.textContent = titles[name] || name;
      if (typeof onLoad === "function") onLoad(name);
    };

    buttons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        activate(button.dataset.section);
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
      });
    });

    const toggle = document.getElementById("btn-toggle-sidebar");
    const sidebar = document.getElementById("sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => {
        const open = sidebar.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") sidebar.classList.remove("open");
      });
    }

    const initial = buttons.find((button) => button.classList.contains("active")) || buttons[0];
    if (initial) activate(initial.dataset.section);
    return activate;
  }

  function installLogout() {
    const buttons = document.querySelectorAll("#btn-logout, #logoutBtn, .logout");
    buttons.forEach((button) => {
      button.onclick = null;
      button.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Log out? Are you sure you want to end this session?")) {
          Store.logout();
          try { sessionStorage.removeItem("currentUser"); } catch (err) {}
          window.location.href = "login";
        }
      });
    });
  }

  function buildLogoutDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "logout-confirmation";
    dialog.innerHTML = `
      <div class="logout-confirmation-panel">
        <h2>Log out?</h2>
        <p>Are you sure you want to end this session?</p>
        <div class="logout-confirmation-actions">
          <button type="button" class="logout-cancel">Stay signed in</button>
          <button type="button" class="logout-confirm">Log out</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);

    const cancel = dialog.querySelector(".logout-cancel");
    const confirm = dialog.querySelector(".logout-confirm");
    let resolver = null;

    const finish = (value) => {
      dialog.close();
      const resolve = resolver;
      resolver = null;
      if (resolve) resolve(value);
    };

    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) finish(false);
    });

    return {
      confirm: () => new Promise((resolve) => {
        resolver = resolve;
        dialog.showModal();
        cancel.focus();
      }),
    };
  }

  function installTablePagination() {
    const enhance = () => {
      document.querySelectorAll("tbody").forEach((tbody) => {
        if (tbody.dataset.paginationReady) return;
        if (tbody.closest("dialog, .modal-overlay")) return;
        const rows = Array.from(tbody.rows);
        if (rows.length <= PAGE_SIZE) return;
        tbody.dataset.paginationReady = "true";

        const state = { page: 1 };
        const controls = document.createElement("div");
        controls.className = "table-pagination";
        controls.innerHTML = `
          <button type="button" data-page-back>Back</button>
          <span data-page-label></span>
          <button type="button" data-page-next>Next</button>`;
        const table = tbody.closest("table");
        (table ? table.closest(".table-wrap") || table : tbody).insertAdjacentElement("afterend", controls);

        const render = () => {
          const currentRows = Array.from(tbody.rows);
          const pageCount = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE));
          state.page = Math.min(state.page, pageCount);
          currentRows.forEach((row, index) => {
            const hidden = index < (state.page - 1) * PAGE_SIZE || index >= state.page * PAGE_SIZE;
            row.hidden = hidden;
            row.style.display = hidden ? "none" : "";
          });
          controls.querySelector("[data-page-label]").textContent = `Page ${state.page} of ${pageCount}`;
          controls.querySelector("[data-page-back]").disabled = state.page <= 1;
          controls.querySelector("[data-page-next]").disabled = state.page >= pageCount;
        };

        controls.querySelector("[data-page-back]").addEventListener("click", () => {
          state.page -= 1;
          render();
        });
        controls.querySelector("[data-page-next]").addEventListener("click", () => {
          state.page += 1;
          render();
        });
        render();
        new MutationObserver(() => {
          state.page = 1;
          render();
        }).observe(tbody, { childList: true });
      });
    };
    enhance();
    new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  }

  function parseChoices(value) {
    try {
      const parsed = JSON.parse(String(value ?? ""));
      if (parsed && Array.isArray(parsed.selected)) return { selected: parsed.selected, other: parsed.other || "" };
      if (Array.isArray(parsed)) return { selected: parsed, other: "" };
    } catch (e) {}
    return { selected: [], other: String(value ?? "") };
  }

  function formatChoices(value) {
    const choices = parseChoices(value);
    return [...choices.selected, choices.other].filter(Boolean).join(", ") || "Not recorded";
  }

  function parseMedications(value) {
    try {
      const parsed = JSON.parse(String(value ?? ""));
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return value ? [{ name: String(value), dosage: "" }] : [];
  }

  function formatMedications(value) {
    return parseMedications(value)
      .filter((medication) => Object.values(medication).some(Boolean))
      .map((medication) => [medication.name, medication.dosage, medication.frequency].filter(Boolean).join(" | "))
      .join("\n") || "Not recorded";
  }

  return {
    currentUser, requireRole, dashboardFor,
    escapeHtml, money, showMessage, clearMessage,
    initNav, installLogout, installTablePagination,
    parseChoices, formatChoices, parseMedications, formatMedications,
  };
})();
