(function () {
  const errorBox = document.getElementById("login-error");
  const noticeBox = document.getElementById("login-notice");
  const button = document.getElementById("btn-login");

  const redirectByRole = (roleName) => {
    window.location.href = Shared.dashboardFor(roleName);
  };

  const hideBoxes = () => {
    errorBox.classList.add("hidden");
    noticeBox.classList.add("hidden");
  };

  const showError = (text) => {
    errorBox.textContent = text;
    errorBox.classList.remove("hidden");
  };

  const handleLogin = () => {
    hideBoxes();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      showError("Please enter both username and password.");
      return;
    }

    const user = Store.login(username, password);
    if (!user) {
      showError("Invalid username or password, or the account is inactive.");
      return;
    }

    if (!["Admin", "Nurse", "Doctor"].includes(user.role_name)) {
      showError("This login is for Admin, Nurse, and Doctor accounts only.");
      return;
    }

    sessionStorage.setItem("currentUser", JSON.stringify(user));
    redirectByRole(user.role_name);
  };

  document.addEventListener("DOMContentLoaded", () => {
    const notice = sessionStorage.getItem("logoutNotice");
    if (notice) {
      noticeBox.textContent = notice;
      noticeBox.classList.remove("hidden");
      sessionStorage.removeItem("logoutNotice");
    }

    const existing = Shared.currentUser();
    if (existing && existing.id) {
      if (["Admin", "Nurse", "Doctor"].includes(existing.role_name)) {
        redirectByRole(existing.role_name);
      } else {
        sessionStorage.removeItem("currentUser");
        showError("This login is for Admin, Nurse, and Doctor accounts only.");
      }
      return;
    }

    button.addEventListener("click", () => {
      button.disabled = true;
      button.textContent = "Signing in...";
      handleLogin();
      button.disabled = false;
      button.textContent = "Log In";
    });

    ["username", "password"].forEach((id) => {
      document.getElementById(id).addEventListener("keyup", (event) => {
        if (event.key === "Enter") handleLogin();
      });
    });
  });
})();
