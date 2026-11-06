package com.arati.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.lifecycle.viewmodel.compose.viewModel
import com.arati.mobile.data.StockRepositoryFactory
import com.arati.mobile.ui.StockRoute
import com.arati.mobile.ui.StockViewModel

class MainActivity : ComponentActivity() {
    private val stockRepository by lazy {
        StockRepositoryFactory.create(BuildConfig.API_BASE_URL)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                val stockViewModel: StockViewModel = viewModel(
                    factory = StockViewModel.Factory(stockRepository)
                )
                StockRoute(stockViewModel)
            }
        }
    }
}

