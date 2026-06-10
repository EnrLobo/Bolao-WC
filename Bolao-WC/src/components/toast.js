export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `notice notice-${type} toast-enter`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.replace("toast-enter", "toast-exit");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3500);
}