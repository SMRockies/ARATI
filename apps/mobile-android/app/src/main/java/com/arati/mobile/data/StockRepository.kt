package com.arati.mobile.data

import com.arati.mobile.domain.StockItem
import com.arati.mobile.domain.TrackingType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.Locale

interface StockRepository {
    val sourceLabel: String

    suspend fun loadStock(): StockLoadResult
}

sealed interface StockLoadResult {
    data class Success(val items: List<StockItem>) : StockLoadResult
    data class Failure(val message: String) : StockLoadResult
}

object StockRepositoryFactory {
    fun create(apiBaseUrl: String): StockRepository =
        if (apiBaseUrl.isBlank()) LocalStockRepository() else ApiStockRepository(apiBaseUrl)
}

private class LocalStockRepository : StockRepository {
    override val sourceLabel = "Local demo"

    override suspend fun loadStock(): StockLoadResult =
        StockLoadResult.Success(
            listOf(
                StockItem(
                    id = "sku-1001",
                    name = "Split air conditioner 1.5T",
                    brand = "Arati demo",
                    sku = "AR-AC-1501",
                    trackingType = TrackingType.SERIAL,
                    warehouse = "Showroom",
                    onHand = BigDecimal("12"),
                    reorderPoint = BigDecimal("5"),
                ),
                StockItem(
                    id = "sku-1002",
                    name = "Double-door refrigerator 250L",
                    brand = "Arati demo",
                    sku = "AR-FR-2500",
                    trackingType = TrackingType.SERIAL,
                    warehouse = "Showroom",
                    onHand = BigDecimal("2"),
                    reorderPoint = BigDecimal("5"),
                ),
                StockItem(
                    id = "sku-1003",
                    name = "Washing machine 7kg",
                    brand = "Arati demo",
                    sku = "AR-WM-0700",
                    trackingType = TrackingType.BATCH,
                    warehouse = "Warehouse",
                    onHand = BigDecimal.ZERO,
                    reorderPoint = BigDecimal("4"),
                ),
                StockItem(
                    id = "sku-1004",
                    name = "Microwave oven 28L",
                    brand = "Arati demo",
                    sku = "AR-MW-2800",
                    trackingType = TrackingType.QUANTITY,
                    warehouse = "Warehouse",
                    onHand = BigDecimal("14"),
                    reorderPoint = BigDecimal("6"),
                ),
            )
        )
}

private class ApiStockRepository(apiBaseUrl: String) : StockRepository {
    override val sourceLabel = "Organization API"
    private val stockEndpoint = buildStockEndpoint(apiBaseUrl)

    override suspend fun loadStock(): StockLoadResult = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            connection = (stockEndpoint.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 15_000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/json")
            }

            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
                return@withContext StockLoadResult.Failure(
                    "Stock API returned HTTP $statusCode."
                )
            }

            val payload = connection.inputStream
                .bufferedReader(Charsets.UTF_8)
                .use { it.readText() }
            StockLoadResult.Success(parseStockItems(payload))
        } catch (error: IOException) {
            StockLoadResult.Failure(error.message ?: "Unable to reach the stock API.")
        } catch (error: JSONException) {
            StockLoadResult.Failure("Stock API returned invalid stock data.")
        } catch (error: IllegalArgumentException) {
            StockLoadResult.Failure(error.message ?: "Stock API returned invalid stock data.")
        } finally {
            connection?.disconnect()
        }
    }
}

private fun buildStockEndpoint(apiBaseUrl: String): URL {
    val baseUri = URI.create(apiBaseUrl.trim())
    require(
        baseUri.scheme.equals("https", ignoreCase = true) &&
            !baseUri.host.isNullOrBlank() &&
            baseUri.userInfo == null &&
            baseUri.query == null &&
            baseUri.fragment == null
    ) {
        "The stock API base URL must be HTTPS and must not contain credentials, a query, or a fragment."
    }

    return URI.create("${baseUri.toString().trimEnd('/')}/api/v1/inventory/stock").toURL()
}

private fun parseStockItems(payload: String): List<StockItem> {
    val items = JSONObject(payload).getJSONArray("items")
    return buildList(items.length()) {
        for (index in 0 until items.length()) {
            add(items.getJSONObject(index).toStockItem())
        }
    }
}

private fun JSONObject.toStockItem(): StockItem {
    val trackingName = getString("tracking").trim().uppercase(Locale.ROOT)
    val trackingType = TrackingType.entries.firstOrNull { it.name == trackingName }
        ?: throw IllegalArgumentException("Unsupported stock tracking type: $trackingName.")

    return StockItem(
        id = getString("id"),
        name = getString("name"),
        brand = getString("brand"),
        sku = getString("sku"),
        trackingType = trackingType,
        warehouse = getString("warehouse"),
        onHand = getDecimal("onHand"),
        reorderPoint = getDecimal("reorderPoint"),
    )
}

private fun JSONObject.getDecimal(name: String): BigDecimal {
    val value = get(name)
    require(value is String) { "$name must be a decimal string." }
    return BigDecimal(value)
}
