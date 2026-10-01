package com.logicraft.shipment;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "shipments")
public class Shipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(nullable = false, unique = true)
    private String reference;

    @Column(nullable = false)
    private String origin;

    @Column(nullable = false)
    private String destination;

    @Column(name = "weight_kg", nullable = false)
    private BigDecimal weightKg;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private String mode;

    @Column(name = "eta")
    private OffsetDateTime eta;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public Shipment() {}

    public Shipment(
        Long id,
        Long workspaceId,
        String reference,
        String origin,
        String destination,
        BigDecimal weightKg,
        String status,
        String mode,
        OffsetDateTime eta,
        OffsetDateTime createdAt
    ) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.reference = reference;
        this.origin = origin;
        this.destination = destination;
        this.weightKg = weightKg;
        this.status = status;
        this.mode = mode;
        this.eta = eta;
        this.createdAt = createdAt;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(Long workspaceId) {
        this.workspaceId = workspaceId;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getOrigin() {
        return origin;
    }

    public void setOrigin(String origin) {
        this.origin = origin;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public OffsetDateTime getEta() {
        return eta;
    }

    public void setEta(OffsetDateTime eta) {
        this.eta = eta;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
