package com.arati.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class StockRepositoryFactoryTest {
    @Test
    fun blankBaseUrlSelectsLocalDemo() {
        assertEquals("Local demo", StockRepositoryFactory.create("").sourceLabel)
    }

    @Test
    fun httpsBaseUrlSelectsOrganizationApi() {
        assertEquals(
            "Organization API",
            StockRepositoryFactory.create("https://erp.example.org").sourceLabel,
        )
    }

    @Test
    fun nonHttpsBaseUrlIsRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            StockRepositoryFactory.create("http://erp.example.org")
        }
    }
}

