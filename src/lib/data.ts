import { isDemoMode } from "@/lib/auth";
import {
  demoBranches,
  demoCustomers,
  demoDevices,
  demoRequests,
  demoSpareParts,
  demoStats,
} from "@/lib/demo-data";
import type {
  Branch,
  Customer,
  DashboardStats,
  Device,
  ServiceRequest,
  SparePart,
} from "@/types/domain";

export async function getCustomers(): Promise<Customer[]> {
  if (isDemoMode()) return demoCustomers;
  return demoCustomers;
}

export async function getBranches(): Promise<Branch[]> {
  if (isDemoMode()) return demoBranches;
  return demoBranches;
}

export async function getDevices(): Promise<Device[]> {
  if (isDemoMode()) return demoDevices;
  return demoDevices;
}

export async function getServiceRequests(): Promise<ServiceRequest[]> {
  if (isDemoMode()) return demoRequests;
  return demoRequests;
}

export async function getSpareParts(): Promise<SparePart[]> {
  if (isDemoMode()) return demoSpareParts;
  return demoSpareParts;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isDemoMode()) return demoStats;
  return demoStats;
}
