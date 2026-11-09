window.DateSelect = (() => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const widgets = new Map();

  const init = (widget) => {
    const target = document.getElementById(widget.dataset.target);
    const month = widget.querySelector("[data-month]");
    const day = widget.querySelector("[data-day]");
    const year = widget.querySelector("[data-year]");
    if (!target || !month || !day || !year) return;

    const today = Store.todayISO();
    const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
    const maxDate = widget.dataset.max === "today" ? today : widget.dataset.max || "9999-12-31";
    const [maxYear, maxMonth, maxDay] = maxDate.split("-").map(Number);
    const fixed = widget.dataset.fixed === "tomorrow";
    const addOption = (select, label, value = "") => select.add(new Option(label, value));

    addOption(month, "Month");
    months.forEach((name, index) => addOption(month, name, String(index + 1).padStart(2, "0")));
    addOption(day, "Day");
    addOption(year, "Year");
    for (let value = todayYear + (fixed ? 1 : 0); value >= todayYear - 120; value -= 1) addOption(year, String(value), String(value));

    const refreshDays = () => {
      const previous = day.value;
      const selectedMonth = Number(month.value);
      const selectedYear = Number(year.value);
      day.replaceChildren();
      addOption(day, "Day");
      const dayCount = selectedMonth && selectedYear ? new Date(selectedYear, selectedMonth, 0).getDate() : 31;
      for (let value = 1; value <= dayCount; value += 1) {
        const iso = `${selectedYear || "0000"}-${String(selectedMonth || 1).padStart(2, "0")}-${String(value).padStart(2, "0")}`;
        const option = new Option(String(value), String(value).padStart(2, "0"));
        if (selectedYear && selectedMonth && iso > maxDate) option.disabled = true;
        day.add(option);
      }
      if ([...day.options].some((option) => option.value === previous && !option.disabled)) day.value = previous;
    };

    const update = (dispatch = true) => {
      refreshDays();
      const complete = month.value && day.value && year.value;
      target.value = complete ? `${year.value}-${month.value}-${day.value}` : "";
      target.setCustomValidity(complete && target.value <= maxDate ? "" : complete ? "Choose a valid date." : "");
      if (dispatch) target.dispatchEvent(new Event("change", { bubbles: true }));
    };

    month.addEventListener("change", () => update());
    day.addEventListener("change", () => update());
    year.addEventListener("change", () => update());
    target.form?.addEventListener("reset", () => window.setTimeout(() => DateSelect.clear(target.id), 0));

    const state = { target, month, day, year, update, refreshDays };
    widgets.set(target.id, state);
    [month, day, year].forEach((select) => { select.disabled = fixed; });
    if (fixed) setValue(target.id, Store.tomorrowISO());
    else update(false);
  };

  const setValue = (id, value) => {
    const state = widgets.get(id);
    if (!state) return;
    if (!value) return clear(id);
    const [year, month, day] = String(value).slice(0, 10).split("-");
    state.year.value = year;
    state.month.value = month;
    state.refreshDays();
    state.day.value = day;
    state.update(false);
  };

  const clear = (id) => {
    const state = widgets.get(id);
    if (!state) return;
    state.month.value = "";
    state.year.value = "";
    state.refreshDays();
    state.day.value = "";
    state.target.value = "";
    state.target.setCustomValidity("");
    state.target.dispatchEvent(new Event("change", { bubbles: true }));
  };

  document.querySelectorAll("[data-date-select]").forEach(init);
  return { setValue, clear };
})();
