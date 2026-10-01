package com.logicraft.shipment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Shipment row as the workspace UI reads it.
 *
 * Field names are the contract: ShipmentsPage, the dashboard dispatch table and
 * ShipmentStepper all read these keys directly off the payload. Renaming one
 * here silently blanks a column, because nothing in the client type-checks it.
 */
public class ShipmentDTO {
    private Long id;
    private String reference;
    private String origin;
    private String destination;
    private String mode;
    private String status;
    private String driverName;
    private String vehiclePlate;
    private BigDecimal weightKg;
    private OffsetDateTime eta;
    private OffsetDateTime createdAt;
    private List<Map<String, Object>> milestones = new ArrayList<>();

    public ShipmentDTO() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDriverName() { return driverName; }
    public void setDriverName(String driverName) { this.driverName = driverName; }

    public String getVehiclePlate() { return vehiclePlate; }
    public void setVehiclePlate(String vehiclePlate) { this.vehiclePlate = vehiclePlate; }

    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }

    public OffsetDateTime getEta() { return eta; }
    public void setEta(OffsetDateTime eta) { this.eta = eta; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public List<Map<String, Object>> getMilestones() { return milestones; }
    public void setMilestones(List<Map<String, Object>> milestones) {
        this.milestones = milestones == null ? new ArrayList<>() : milestones;
    }
}
