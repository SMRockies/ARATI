package com.arati.mobile.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.arati.mobile.data.StockLoadResult
import com.arati.mobile.data.StockRepository
import com.arati.mobile.domain.StockItem
import com.arati.mobile.domain.StockStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale

enum class StockFilter(val label: String) {
    ALL("All"),
    IN_STOCK("In stock"),
    LOW_STOCK("Low stock"),
    OUT_OF_STOCK("Out of stock"),
}

data class StockUiState(
    val items: List<StockItem> = emptyList(),
    val query: String = "",
    val filter: StockFilter = StockFilter.ALL,
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val sourceLabel: String = "",
) {
    val visibleItems: List<StockItem>
        get() {
            val normalizedQuery = query.trim().lowercase(Locale.ROOT)
            return items.filter { item ->
                val matchesQuery = normalizedQuery.isEmpty() ||
                    listOf(item.name, item.brand, item.sku, item.warehouse)
                        .any { it.lowercase(Locale.ROOT).contains(normalizedQuery) }
                val matchesFilter = when (filter) {
                    StockFilter.ALL -> true
                    StockFilter.IN_STOCK -> item.status == StockStatus.IN_STOCK
                    StockFilter.LOW_STOCK -> item.status == StockStatus.LOW_STOCK
                    StockFilter.OUT_OF_STOCK -> item.status == StockStatus.OUT_OF_STOCK
                }
                matchesQuery && matchesFilter
            }
        }

    fun count(status: StockStatus): Int = items.count { it.status == status }
}

class StockViewModel(private val repository: StockRepository) : ViewModel() {
    private val mutableUiState = MutableStateFlow(
        StockUiState(sourceLabel = repository.sourceLabel)
    )
    val uiState: StateFlow<StockUiState> = mutableUiState.asStateFlow()

    init {
        refresh()
    }

    fun updateQuery(query: String) {
        mutableUiState.value = mutableUiState.value.copy(query = query)
    }

    fun updateFilter(filter: StockFilter) {
        mutableUiState.value = mutableUiState.value.copy(filter = filter)
    }

    fun refresh() {
        mutableUiState.value = mutableUiState.value.copy(
            items = emptyList(),
            isLoading = true,
            errorMessage = null,
        )
        viewModelScope.launch {
            when (val result = repository.loadStock()) {
                is StockLoadResult.Success -> {
                    mutableUiState.value = mutableUiState.value.copy(
                        items = result.items,
                        isLoading = false,
                        errorMessage = null,
                    )
                }
                is StockLoadResult.Failure -> {
                    mutableUiState.value = mutableUiState.value.copy(
                        isLoading = false,
                        errorMessage = result.message,
                    )
                }
            }
        }
    }

    class Factory(private val repository: StockRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(StockViewModel::class.java)) {
                "Unsupported ViewModel type: ${modelClass.name}"
            }
            return StockViewModel(repository) as T
        }
    }
}

