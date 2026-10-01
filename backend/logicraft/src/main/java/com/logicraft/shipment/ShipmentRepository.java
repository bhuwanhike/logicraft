package com.logicraft.shipment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShipmentRepository extends JpaRepository<Shipment, Long> {
    Page<Shipment> findByWorkspaceId(Long workspaceId, Pageable pageable);

    Page<Shipment> findByWorkspaceIdAndStatus(
        Long workspaceId,
        String status,
        Pageable pageable
    );

    @Query(
        "SELECT s FROM Shipment s WHERE s.workspaceId = :workspaceId AND " +
            "(LOWER(s.reference) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            " LOWER(s.origin) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            " LOWER(s.destination) LIKE LOWER(CONCAT('%', :q, '%')))"
    )
    Page<Shipment> searchShipments(
        @Param("workspaceId") Long workspaceId,
        @Param("q") String q,
        Pageable pageable
    );
}
