import { mockEvents } from "../data/mockEvents";
import { mockAlerts } from "../data/mockAlerts";
import { mockUsers } from "../data/mockUsers";
import { mockIncidents } from "../data/mockIncidents";
import { mockRules } from "../data/mockRules";

export async function getDashboardData() {
  return {
    stats: {
      totalEvents: mockEvents.length,
      activeAlerts: mockAlerts.filter((alert) => !alert.seen).length,
      criticalAlerts: mockAlerts.filter(
        (alert) => alert.severity === "Critical"
      ).length,
      monitoredUsers: mockUsers.length,
      openIncidents: mockIncidents.filter(
        (incident) => incident.status === "OPEN"
      ).length,
    },

    events: mockEvents,
    alerts: mockAlerts,
    users: mockUsers,
    incidents: mockIncidents,
    rules: mockRules,
  };
}

export async function getEvents() {
  return mockEvents;
}

export async function getAlerts() {
  return mockAlerts;
}

export async function getUsers() {
  return mockUsers;
}

export async function getIncidents() {
  return mockIncidents;
}

export async function getRules() {
  return mockRules;
}

export async function getAlertById(id) {
  return mockAlerts.find((alert) => alert.id === id);
}
