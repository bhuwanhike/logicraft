/**
 * Real API payloads, captured from a running backend.
 *
 * These are the shapes the workspace actually receives, not hand-written
 * approximations. Two classes of bug only appear against real data: a column
 * key the projection never aliased, and a value that arrives as a driver type
 * (TEXT[] as an array, jsonb as an object) rather than a JSON primitive. Both
 * shipped as blank or "[object Object]" cells before the render path was fixed.
 *
 * Captured with: curl "http://localhost:8080/api/v1/<resource>?workspaceId=1&size=2"
 * Trimmed to 2 rows each. Regenerate with: npm run test:fixtures
 *
 * Do not hand-edit: change the projection and re-capture instead.
 */
import type { Rows } from "../../types";

/** drivers */
export const driversPayload: Rows = [
  {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@logicraft.io",
    "phone": "+1-555-0192",
    "status": "on_route",
    "licenseNumber": "DL-994821",
    "licenseExpiry": "2027-10-26",
    "safetyScore": 98,
    "rating": 4.9,
    "tripsCompleted": 142,
    "weeklyHours": 39.5,
    "certifications": [
      "CDL-A",
      "Tanker"
    ],
    "joinedAt": "2026-10-01"
  },
  {
    "id": 2,
    "name": "Sarah Connor",
    "email": "sarah.c@logicraft.io",
    "phone": "+1-555-0183",
    "status": "available",
    "licenseNumber": "DL-882103",
    "licenseExpiry": "2028-05-23",
    "safetyScore": 95,
    "rating": 4.8,
    "tripsCompleted": 89,
    "weeklyHours": 33,
    "certifications": [
      "Hazmat",
      "CDL-A"
    ],
    "joinedAt": "2026-10-01"
  }
];

/** vehicles */
export const vehiclesPayload: Rows = [
  {
    "id": 1,
    "plate": "TRK-8801",
    "type": "truck",
    "status": "active",
    "vin": "1FTFW1ET4DFC10312",
    "make": "Freightliner",
    "model": "Cascadia 126",
    "year": 2021,
    "capacityKg": 15000,
    "fuelLevel": 78,
    "odometerKm": 412880.5,
    "lastServiceAt": "2026-07-31T00:10:48.653+00:00",
    "nextServiceAt": "2026-10-09T00:10:48.653+00:00",
    "locationLabel": "Chicago, IL",
    "lat": 41.8781,
    "lng": -87.6298,
    "createdAt": "2026-10-01T00:10:47.578+00:00",
    "currentDriverName": "John Doe",
    "documentCount": 3
  },
  {
    "id": 2,
    "plate": "VAN-2004",
    "type": "van",
    "status": "active",
    "vin": "1GCWAFPB4M1138274",
    "make": "Chevrolet",
    "model": "Express 3500",
    "year": 2020,
    "capacityKg": 3500,
    "fuelLevel": 41,
    "odometerKm": 96410,
    "lastServiceAt": "2026-08-21T00:10:48.653+00:00",
    "nextServiceAt": "2026-10-20T00:10:48.653+00:00",
    "locationLabel": "Chicago, IL",
    "lat": 41.8819,
    "lng": -87.6278,
    "createdAt": "2026-10-01T00:10:47.578+00:00",
    "currentDriverName": "Sarah Connor",
    "documentCount": 2
  }
];

/** trips */
export const tripsPayload: Rows = [
  {
    "id": 1,
    "reference": "TRIP-F01D13-001",
    "plate": "TRK-8801",
    "status": "active",
    "origin": "Chicago, IL",
    "destination": "Los Angeles, CA",
    "lat": 42.37933,
    "lng": -88.076989,
    "eta": "2026-10-01T12:10:48.624+00:00",
    "speedKph": 72.5,
    "fuelLevel": 85,
    "headingDeg": 47,
    "distanceKm": 180.5,
    "lastReportedAt": "2026-10-01T00:10:48.624+00:00",
    "driverName": "John Doe",
    "vehiclePlate": "TRK-8801"
  },
  {
    "id": 2,
    "reference": "TRIP-FE65A0-002",
    "plate": "TRK-8801",
    "status": "active",
    "origin": "Chicago, IL",
    "destination": "Los Angeles, CA",
    "lat": 41.761666,
    "lng": -88.418627,
    "eta": "2026-10-01T12:10:48.624+00:00",
    "speedKph": 72.5,
    "fuelLevel": 85,
    "headingDeg": 94,
    "distanceKm": 321,
    "lastReportedAt": "2026-10-01T00:10:48.624+00:00",
    "driverName": "John Doe",
    "vehiclePlate": "TRK-8801"
  }
];

/** shipments */
export const shipmentsPayload: Rows = [
  {
    "id": 50003,
    "reference": "LOG-1C0581A4-50000",
    "origin": "Philadelphia, PA",
    "destination": "Boston, MA",
    "mode": "air",
    "status": "delivered",
    "driverName": "Sarah Connor",
    "vehiclePlate": "TRK-8801",
    "weightKg": 926.18,
    "eta": "2026-10-10T04:41:15.756331Z",
    "createdAt": "2026-09-26T20:07:44.092633Z",
    "milestones": []
  },
  {
    "id": 50002,
    "reference": "LOG-FF2EDF34-49999",
    "origin": "Newark, NJ",
    "destination": "Detroit, MI",
    "mode": "sea",
    "status": "cancelled",
    "driverName": "Unassigned",
    "vehiclePlate": "Not assigned",
    "weightKg": 129.4,
    "eta": "2026-10-08T01:27:14.410462Z",
    "createdAt": "2026-08-28T23:49:41.699446Z",
    "milestones": []
  }
];

/** warehouses */
export const warehousesPayload: Rows = [
  {
    "id": 1,
    "name": "Central Logistics Hub",
    "status": "operational",
    "address": "1200 S Canal St, Chicago, IL 60606",
    "lat": 41.8679,
    "lng": -87.6432,
    "usedCapacity": 14810,
    "totalCapacity": 20500,
    "createdAt": "2026-10-01T00:10:47.578+00:00"
  },
  {
    "id": 2,
    "name": "West Coast Hub",
    "status": "operational",
    "address": "88 Portside Dr, Newark, NJ 07114",
    "lat": 40.6895,
    "lng": -74.1745,
    "usedCapacity": 3860,
    "totalCapacity": 9000,
    "createdAt": "2026-10-01T00:10:47.578+00:00"
  }
];

/** zones */
export const zonesPayload: Rows = [
  {
    "id": 1,
    "code": "COLD",
    "name": "Cold Storage",
    "description": "Refrigerated and frozen goods",
    "status": "active",
    "warehouseId": 1,
    "capacityUnits": 2500,
    "usedCapacity": 940,
    "dockDoors": 2,
    "temperatureControlled": true
  },
  {
    "id": 2,
    "code": "BULK",
    "name": "Bulk Storage",
    "description": "Pallet racking, heavy freight",
    "status": "congested",
    "warehouseId": 1,
    "capacityUnits": 8000,
    "usedCapacity": 7450,
    "dockDoors": 3,
    "temperatureControlled": false
  }
];

/** inventory */
export const inventoryPayload: Rows = [
  {
    "id": 1,
    "sku": "SKU-1002",
    "name": "Chilled chicken 5kg",
    "unit": "case",
    "warehouseId": 1,
    "quantity": 88,
    "reservedQuantity": 12,
    "reorderPoint": 120,
    "reorderQuantity": 300,
    "binLocation": "COLD-A-04",
    "weightKg": 9.8,
    "lastMovementAt": "2026-09-30T00:10:48.653+00:00",
    "zone": "COLD"
  },
  {
    "id": 2,
    "sku": "SKU-1001",
    "name": "Frozen blueberries 2kg",
    "unit": "case",
    "warehouseId": 1,
    "quantity": 420,
    "reservedQuantity": 60,
    "reorderPoint": 150,
    "reorderQuantity": 400,
    "binLocation": "COLD-A-01",
    "weightKg": 12.4,
    "lastMovementAt": "2026-09-30T21:10:48.653+00:00",
    "zone": "COLD"
  }
];

/** notifications */
export const notificationsPayload: Rows = [
  {
    "id": 1,
    "level": "critical",
    "title": "Cold chain breach on LOG-3310-Z",
    "message": "Reefer temperature reached 11.4C, 3.2C above the limit for 40 minutes on arrival.",
    "detail": "Reefer temperature reached 11.4C, 3.2C above the limit for 40 minutes on arrival.",
    "entityType": "shipment",
    "entityId": 3,
    "reference": "LOG-3310-Z",
    "read": false,
    "readAt": null,
    "at": "2026-09-30T23:58:48.653+00:00",
    "createdAt": "2026-09-30T23:58:48.653+00:00"
  },
  {
    "id": 2,
    "level": "info",
    "title": "Shipment LOG-3310-Z delivered",
    "message": "Signed for by R. Alvarez at Seattle, WA.",
    "detail": "Signed for by R. Alvarez at Seattle, WA.",
    "entityType": "shipment",
    "entityId": 3,
    "reference": "LOG-3310-Z",
    "read": false,
    "readAt": null,
    "at": "2026-09-30T17:10:48.653+00:00",
    "createdAt": "2026-09-30T17:10:48.653+00:00"
  }
];

/** audit-logs */
export const auditLogsPayload: Rows = [
  {
    "id": 1,
    "at": "2026-08-22T00:10:48.653+00:00",
    "createdAt": "2026-08-22T00:10:48.653+00:00",
    "actorName": "Jules Okafor",
    "actorRole": "Fleet Supervisor",
    "action": "user.suspend",
    "entityType": "user",
    "entityId": "5",
    "summary": "Suspended s.boateng pending compliance review",
    "ip": "10.14.2.44",
    "userAgent": "Recorded by service"
  },
  {
    "id": 2,
    "at": "2026-09-29T00:10:48.653+00:00",
    "createdAt": "2026-09-29T00:10:48.653+00:00",
    "actorName": "Demo",
    "actorRole": "Operations Manager",
    "action": "user.invite",
    "entityType": "user",
    "entityId": "4",
    "summary": "Invited m.tanaka@logicraft.io as Warehouse Associate",
    "ip": "10.14.2.10",
    "userAgent": "Recorded by service"
  }
];

/** users */
export const usersPayload: Rows = [
  {
    "id": 1,
    "name": "Demo",
    "username": "demo",
    "email": "demo@logicraft.io",
    "company": "LogiCraft",
    "role": "Operations Manager",
    "status": "active",
    "is_active": true,
    "lastActiveAt": "2026-10-01T00:06:48.653+00:00",
    "createdAt": "2026-07-03T00:10:48.653+00:00"
  },
  {
    "id": 2,
    "name": "Ana",
    "username": "a.reyes",
    "email": "a.reyes@logicraft.io",
    "company": "Northwind Freight",
    "role": "DISPATCHER",
    "status": "active",
    "is_active": true,
    "lastActiveAt": "2026-09-30T22:10:48.653+00:00",
    "createdAt": "2026-03-05T00:10:48.653+00:00"
  }
];
