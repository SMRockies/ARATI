package com.arati.mobile.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.arati.mobile.domain.StockItem
import com.arati.mobile.domain.StockStatus
import java.math.BigDecimal

@Composable
fun StockRoute(viewModel: StockViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    StockScreen(
        state = state,
        onQueryChanged = viewModel::updateQuery,
        onFilterChanged = viewModel::updateFilter,
        onRefresh = viewModel::refresh,
    )
}

@Composable
private fun StockScreen(
    state: StockUiState,
    onQueryChanged: (String) -> Unit,
    onFilterChanged: (StockFilter) -> Unit,
    onRefresh: () -> Unit,
) {
    Scaffold { contentPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(contentPadding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Stock overview",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "Read-only inventory · ${state.sourceLabel}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Button(onClick = onRefresh, enabled = !state.isLoading) {
                    Text("Refresh")
                }
            }

            Spacer(Modifier.height(16.dp))
            if (state.items.isNotEmpty()) {
                StockSummary(state)
                Spacer(Modifier.height(12.dp))
            }

            OutlinedTextField(
                value = state.query,
                onValueChange = onQueryChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search stock") },
                placeholder = { Text("Product, brand, SKU, or warehouse") },
                singleLine = true,
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StockFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = state.filter == filter,
                        onClick = { onFilterChanged(filter) },
                        label = { Text(filter.label) },
                    )
                }
            }

            when {
                state.isLoading -> LoadingState()
                state.errorMessage != null -> ErrorState(state.errorMessage, onRefresh)
                state.items.isEmpty() -> EmptyState("No stock records are available.")
                state.visibleItems.isEmpty() -> EmptyState("No stock records match this search.")
                else -> {
                    Text(
                        text = "${state.visibleItems.size} of ${state.items.size} items",
                        modifier = Modifier.padding(bottom = 8.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(state.visibleItems, key = StockItem::id) { item ->
                            StockItemCard(item)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StockSummary(state: StockUiState) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SummaryCard("SKUs", state.items.size.toString(), Modifier.weight(1f))
        SummaryCard(
            "In stock",
            state.count(StockStatus.IN_STOCK).toString(),
            Modifier.weight(1f),
        )
        SummaryCard(
            "Low",
            state.count(StockStatus.LOW_STOCK).toString(),
            Modifier.weight(1f),
        )
        SummaryCard(
            "Out",
            state.count(StockStatus.OUT_OF_STOCK).toString(),
            Modifier.weight(1f),
        )
    }
}

@Composable
private fun SummaryCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium)
            Text(
                value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun StockItemCard(item: StockItem) {
    val statusColor = when (item.status) {
        StockStatus.IN_STOCK -> MaterialTheme.colorScheme.secondaryContainer
        StockStatus.LOW_STOCK -> MaterialTheme.colorScheme.tertiaryContainer
        StockStatus.OUT_OF_STOCK -> MaterialTheme.colorScheme.errorContainer
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        item.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "${item.brand} · ${item.sku}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Card(colors = CardDefaults.cardColors(containerColor = statusColor)) {
                    Text(
                        item.status.label,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(
                "${item.warehouse} · ${item.trackingType.name.lowercase().replaceFirstChar { it.uppercase() }} tracked",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("On hand: ${item.onHand.displayQuantity()}")
                Text(
                    "Reorder at: ${item.reorderPoint.displayQuantity()}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorState(message: String, onRefresh: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Could not load stock", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Text(message, color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRefresh) {
            Text("Try again")
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun BigDecimal.displayQuantity(): String =
    stripTrailingZeros().toPlainString()
