package com.arati.mobile.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class StockItemTest {
    @Test
    fun zeroOnHandIsOutOfStock() {
        val item = stockItem(onHand = "0", reorderPoint = "5")

        assertEquals(StockStatus.OUT_OF_STOCK, item.status)
    }

    @Test
    fun quantityAtReorderPointIsLowStock() {
        val item = stockItem(onHand = "2.5", reorderPoint = "2.50")

        assertEquals(StockStatus.LOW_STOCK, item.status)
    }

    @Test
    fun quantityAboveReorderPointIsInStock() {
        val item = stockItem(onHand = "2.51", reorderPoint = "2.5")

        assertEquals(StockStatus.IN_STOCK, item.status)
    }

    @Test(expected = IllegalArgumentException::class)
    fun negativeOnHandIsRejected() {
        stockItem(onHand = "-1", reorderPoint = "0")
    }

    private fun stockItem(onHand: String, reorderPoint: String) = StockItem(
        id = "sku-1",
        name = "Demo item",
        brand = "Demo",
        sku = "SKU-1",
        trackingType = TrackingType.QUANTITY,
        warehouse = "Main",
        onHand = BigDecimal(onHand),
        reorderPoint = BigDecimal(reorderPoint),
    )
}

