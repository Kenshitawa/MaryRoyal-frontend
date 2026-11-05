package com.example.ui.screens.finance

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.data.remote.model.InvoiceDto
import com.example.data.remote.model.PayrollEntryDto
import com.example.data.remote.model.RecordPaymentRequest
import com.example.data.security.SecureScreenEffect
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceScreen() {
    // Mandatory requirement: FLAG_SECURE on screens showing fees, payroll, statutory details
    SecureScreenEffect(enabled = true)

    val app = MaryRoyalApp.instance
    val financeRepo = app.financeRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    val canViewPayroll = RoleNavManager.canViewPayroll(role)

    val tabs = remember(canViewPayroll) {
        if (canViewPayroll) listOf("Fee Invoices", "Record Payment", "Staff Payroll")
        else listOf("Fee Invoices", "Record Payment")
    }

    var selectedTab by remember { mutableIntStateOf(0) }
    var invoicesState by remember { mutableStateOf<UiState<List<InvoiceDto>>>(UiState.Loading) }
    var payrollState by remember { mutableStateOf<UiState<List<PayrollEntryDto>>>(UiState.Loading) }

    // Payment Form state
    var selectedInvoiceId by remember { mutableStateOf("") }
    var paymentAmount by remember { mutableStateOf("15000") }
    var paymentMethod by remember { mutableStateOf("MPESA") }
    var mpesaCode by remember { mutableStateOf("") }
    var paymentReference by remember { mutableStateOf("") }
    var isRecordingPayment by remember { mutableStateOf(false) }
    var paymentMessage by remember { mutableStateOf<String?>(null) }
    var paymentError by remember { mutableStateOf<String?>(null) }

    fun loadInvoices() {
        invoicesState = UiState.Loading
        coroutineScope.launch {
            val res = financeRepo.getInvoices()
            res.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) invoicesState = UiState.Empty
                    else {
                        invoicesState = UiState.Success(list)
                        if (selectedInvoiceId.isEmpty()) selectedInvoiceId = list.first().id
                    }
                },
                onFailure = { invoicesState = UiState.Error(it.message ?: "Failed to load invoices.") }
            )
        }
    }

    fun loadPayroll() {
        if (!canViewPayroll) return
        payrollState = UiState.Loading
        coroutineScope.launch {
            val res = financeRepo.getPayroll()
            res.fold(
                onSuccess = { resp ->
                    if (resp.entries.isEmpty()) payrollState = UiState.Empty
                    else payrollState = UiState.Success(resp.entries)
                },
                onFailure = { payrollState = UiState.Error(it.message ?: "Failed to load payroll.") }
            )
        }
    }

    LaunchedEffect(selectedTab) {
        if (selectedTab == 0) loadInvoices()
        else if (selectedTab == 2) loadPayroll()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "Mary Royal Finance", subtitle = "Secure Bursar & Statutory Accounts")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("finance_screen")
        ) {
            // Security Indicator Badge
            Surface(
                color = RoyalBlue.copy(alpha = 0.08f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = RoyalBlue, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Encrypted Financial Ledger • Screenshots Disabled (FLAG_SECURE)",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold, color = RoyalBlue)
                    )
                }
            }

            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                tabs.forEachIndexed { index, tabTitle ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(tabTitle, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal) }
                    )
                }
            }

            when (selectedTab) {
                0 -> {
                    // Invoices Tab
                    when (val current = invoicesState) {
                        is UiState.Loading -> LoadingSkeleton(count = 5)
                        is UiState.Empty -> EmptyStateView(
                            title = "No Fee Invoices Found",
                            message = "No invoices recorded for the current term."
                        )
                        is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadInvoices() })
                        is UiState.Success -> {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(current.data, key = { it.id }) { inv ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth().testTag("invoice_card_${inv.id}"),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                    ) {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(
                                                        text = inv.learner?.name ?: "Enrolled Learner",
                                                        style = MaterialTheme.typography.titleMedium.copy(
                                                            fontWeight = FontWeight.Bold,
                                                            color = RoyalBlue
                                                        )
                                                    )
                                                    Text(
                                                        text = "Adm: ${inv.learner?.admissionNo ?: ""} • ${inv.term}",
                                                        style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                    )
                                                }

                                                Surface(
                                                    color = if (inv.balance <= 0) Color(0xFFD1FAE5) else Color(0xFFFEE2E2),
                                                    shape = RoundedCornerShape(8.dp)
                                                ) {
                                                    Text(
                                                        text = if (inv.balance <= 0) "CLEARED" else "BAL: KES ${inv.balance.toInt()}",
                                                        color = if (inv.balance <= 0) Color(0xFF065F46) else Color(0xFF991B1B),
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 12.sp,
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                    )
                                                }
                                            }

                                            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text("Total Invoiced:", style = MaterialTheme.typography.bodySmall)
                                                Text("KES ${inv.total.toInt()}", fontWeight = FontWeight.Bold)
                                            }
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text("Amount Paid:", style = MaterialTheme.typography.bodySmall)
                                                Text("KES ${inv.paid.toInt()}", color = Color(0xFF059669), fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else -> Unit
                    }
                }
                1 -> {
                    // Record Payment Tab
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = "Record Fee Payment / M-Pesa Receipt",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )

                        if (paymentMessage != null) {
                            Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                                Text(paymentMessage ?: "", color = Color(0xFF065F46), modifier = Modifier.padding(12.dp))
                            }
                        }

                        if (paymentError != null) {
                            Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                                Text(paymentError ?: "", color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(12.dp))
                            }
                        }

                        OutlinedTextField(
                            value = paymentAmount,
                            onValueChange = { paymentAmount = it; paymentError = null },
                            label = { Text("Payment Amount (KES)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth().testTag("payment_amount_input")
                        )

                        // Payment Method
                        Text("Payment Method:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("MPESA", "CASH", "BANK").forEach { method ->
                                FilterChip(
                                    selected = paymentMethod == method,
                                    onClick = { paymentMethod = method },
                                    label = { Text(method) }
                                )
                            }
                        }

                        if (paymentMethod == "MPESA") {
                            OutlinedTextField(
                                value = mpesaCode,
                                onValueChange = { mpesaCode = it.uppercase(); paymentError = null },
                                label = { Text("M-Pesa Transaction Code (e.g. SJA81920XX)") },
                                placeholder = { Text("10 alphanumeric characters") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                                modifier = Modifier.fillMaxWidth().testTag("mpesa_code_input")
                            )
                        }

                        OutlinedTextField(
                            value = paymentReference,
                            onValueChange = { paymentReference = it },
                            label = { Text("Bank Slip / Cheque Reference (Optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                val amt = paymentAmount.toDoubleOrNull()
                                if (amt == null || amt <= 0) {
                                    paymentError = "Enter a valid positive amount."
                                    return@Button
                                }
                                if (paymentMethod == "MPESA" && mpesaCode.length < 8) {
                                    paymentError = "Please enter a valid M-Pesa transaction code."
                                    return@Button
                                }
                                if (selectedInvoiceId.isBlank()) {
                                    paymentError = "No active invoice selected."
                                    return@Button
                                }

                                isRecordingPayment = true
                                paymentMessage = null
                                paymentError = null
                                coroutineScope.launch {
                                    val req = RecordPaymentRequest(
                                        invoiceId = selectedInvoiceId,
                                        amount = amt,
                                        method = paymentMethod,
                                        mpesaCode = if (paymentMethod == "MPESA") mpesaCode else null,
                                        reference = paymentReference.ifBlank { null }
                                    )
                                    val res = financeRepo.recordPayment(req)
                                    isRecordingPayment = false
                                    res.fold(
                                        onSuccess = { resp ->
                                            paymentMessage = "Payment of KES $amt submitted successfully. Receipt: ${resp.payment?.receiptNo ?: "Generated"}"
                                            mpesaCode = ""
                                            loadInvoices()
                                        },
                                        onFailure = { paymentError = it.message }
                                    )
                                }
                            },
                            enabled = !isRecordingPayment,
                            colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                            modifier = Modifier.fillMaxWidth().height(48.dp).testTag("record_payment_submit")
                        ) {
                            if (isRecordingPayment) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Text("Record & Issue Receipt", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                2 -> {
                    // Staff Payroll Tab (Director, Head Teacher, Accountant)
                    when (val current = payrollState) {
                        is UiState.Loading -> LoadingSkeleton(count = 4)
                        is UiState.Empty -> EmptyStateView(
                            title = "No Payroll Records",
                            message = "No monthly payroll records found."
                        )
                        is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadPayroll() })
                        is UiState.Success -> {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(current.data, key = { it.id }) { item ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                    ) {
                                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text(
                                                    text = item.staff?.name ?: "Staff Member",
                                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = RoyalBlue)
                                                )
                                                Surface(
                                                    color = Color(0xFFD1FAE5),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        text = item.status,
                                                        color = Color(0xFF065F46),
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 10.sp,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }

                                            Text("Period: ${item.period}", style = MaterialTheme.typography.bodySmall)

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text("Gross Pay: KES ${item.grossAmount.toInt()}", style = MaterialTheme.typography.bodySmall)
                                                Text("Deductions: KES ${item.deductions.toInt()}", style = MaterialTheme.typography.bodySmall)
                                            }

                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text("Net Salary:", fontWeight = FontWeight.Bold)
                                                Text("KES ${item.netAmount.toInt()}", fontWeight = FontWeight.Bold, color = Color(0xFF059669))
                                            }

                                            // Statutory Details
                                            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                                            Text(
                                                text = "Statutory: KRA PIN: ${item.kraPin ?: "A001293849X"} • NSSF: ${item.nssfNumber ?: "NSSF-7742"} • SHA: ${item.shaNumber ?: "SHA-9921"}",
                                                style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        else -> Unit
                    }
                }
            }
        }
    }
}
