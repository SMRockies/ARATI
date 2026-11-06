package com.arati.mobile.ui

import com.arati.mobile.domain.StockItem
import com.arati.mobile.domain.TrackingType
import org.junit.Assert.assertEquals
import org.junit.Test
import java.math.BigDecimal

class StockUiStateTest {
    @Test
    fun searchMatchesWarehouseWithoutCaseSensitivity() {
        val state = StockUiState(
            items = listOf(item("Split AC", "Showroom", "10", "4")),
            isLoading = false,
        ).copy(query = "show")

        assertEquals(1, state.visibleItems.size)
    }

    @Test
    fun lowStockFilterUsesDerivedStatus() {
        val state = StockUiState(
            items = listOf(
                item("Low item", "Main", "2", "5"),
                item("Available item", "Main", "8", "5"),
            ),
            isLoading = false,
            filter = StockFilter.LOW_STOCK,
        )

        assertEquals(listOf("Low item"), state.visibleItems.map(StockItem::name))
    }

    private fun item(
        name: String,
        warehouse: String,
        onHand: String,
        reorderPoint: String,
    ) = StockItem(
        id = name,
        name = name,
        brand = "Demo",
        sku = name,
        trackingType = TrackingType.QUANTITY,
        warehouse = warehouse,
        onHand = BigDecimal(onHand),
        reorderPoint = BigDecimal(reorderPoint),
    )
}

