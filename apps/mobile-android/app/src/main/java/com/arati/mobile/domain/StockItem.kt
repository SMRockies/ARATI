package com.arati.mobile.domain

import java.math.BigDecimal

enum class TrackingType {
    QUANTITY,
    SERIAL,
    BATCH,
    HYBRID,
}

enum class StockStatus(val label: String) {
    IN_STOCK("In stock"),
    LOW_STOCK("Low stock"),
    OUT_OF_STOCK("Out of stock"),
}

data class StockItem(
    val id: String,
    val name: String,
    val brand: String,
    val sku: String,
    val trackingType: TrackingType,
    val warehouse: String,
    val onHand: BigDecimal,
    val reorderPoint: BigDecimal,
) {
    init {
        require(id.isNotBlank()) { "Stock item id is required." }
        require(name.isNotBlank()) { "Stock item name is required." }
        require(sku.isNotBlank()) { "Stock item SKU is required." }
        require(warehouse.isNotBlank()) { "Stock item warehouse is required." }
        require(onHand.signum() >= 0) { "On-hand quantity cannot be negative." }
        require(reorderPoint.signum() >= 0) { "Reorder point cannot be negative." }
    }

    val status: StockStatus
        get() = when {
            onHand.compareTo(BigDecimal.ZERO) == 0 -> StockStatus.OUT_OF_STOCK
            onHand <= reorderPoint -> StockStatus.LOW_STOCK
            else -> StockStatus.IN_STOCK
        }
}

