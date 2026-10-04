const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// Dashboard
export async function getDashboard() {
  return request("/dashboard");
}

// Events
export async function getEvents() {
  return request("/events");
}

// Alerts
export async function getAlerts() {
  return request("/alerts");
}

export async function getAlert(id) {
  return request(`/alerts/${id}`);
}

// Users
export async function getUsers() {
  return request("/users");
}

// Hosts / Devices
export async function getHosts() {
  return request("/hosts");
}

// Detection rules
export async function getRules() {
  return request("/rules");
}

// Backend health check
export async function getHealth() {
  return request("/health");
}
