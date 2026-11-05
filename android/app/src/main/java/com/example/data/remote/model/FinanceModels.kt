package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class InvoiceLineDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "category") val category: String,
    @Json(name = "description") val description: String,
    @Json(name = "amount") val amount: Double
)

@JsonClass(generateAdapter = true)
data class FeePaymentDto(
    @Json(name = "id") val id: String,
    @Json(name = "receiptNo") val receiptNo: String,
    @Json(name = "amount") val amount: Double,
    @Json(name = "method") val method: String,
    @Json(name = "mpesaCode") val mpesaCode: String? = null,
    @Json(name = "reference") val reference: String? = null,
    @Json(name = "status") val status: String,
    @Json(name = "voidReason") val voidReason: String? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class InvoiceDto(
    @Json(name = "id") val id: String,
    @Json(name = "learnerId") val learnerId: String,
    @Json(name = "term") val term: String,
    @Json(name = "dueAt") val dueAt: String? = null,
    @Json(name = "creditApplied") val creditApplied: Double = 0.0,
    @Json(name = "total") val total: Double = 0.0,
    @Json(name = "paid") val paid: Double = 0.0,
    @Json(name = "balance") val balance: Double = 0.0,
    @Json(name = "learner") val learner: AssessmentLearnerInfo? = null,
    @Json(name = "lines") val lines: List<InvoiceLineDto> = emptyList(),
    @Json(name = "payments") val payments: List<FeePaymentDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class InvoicesResponse(
    @Json(name = "invoices") val invoices: List<InvoiceDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateInvoiceRequest(
    @Json(name = "learnerId") val learnerId: String,
    @Json(name = "term") val term: String,
    @Json(name = "dueAt") val dueAt: String? = null,
    @Json(name = "items") val items: List<InvoiceLineDto>? = null,
    @Json(name = "structureLineIds") val structureLineIds: List<String>? = null
)

@JsonClass(generateAdapter = true)
data class RecordPaymentRequest(
    @Json(name = "invoiceId") val invoiceId: String,
    @Json(name = "amount") val amount: Double,
    @Json(name = "method") val method: String,
    @Json(name = "mpesaCode") val mpesaCode: String? = null,
    @Json(name = "reference") val reference: String? = null
)

@JsonClass(generateAdapter = true)
data class PaymentResponse(
    @Json(name = "payment") val payment: FeePaymentDto? = null,
    @Json(name = "creditAmount") val creditAmount: Double = 0.0,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class FeeStructureLineDto(
    @Json(name = "id") val id: String,
    @Json(name = "category") val category: String,
    @Json(name = "description") val description: String,
    @Json(name = "amount") val amount: Double,
    @Json(name = "optional") val optional: Boolean = false
)

@JsonClass(generateAdapter = true)
data class FeeStructureDto(
    @Json(name = "id") val id: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "term") val term: String,
    @Json(name = "active") val active: Boolean = true,
    @Json(name = "lines") val lines: List<FeeStructureLineDto> = emptyList()
)

@JsonClass(generateAdapter = true)
data class FeeStructuresResponse(
    @Json(name = "structures") val structures: List<FeeStructureDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class PayrollStaffDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String? = null
)

@JsonClass(generateAdapter = true)
data class PayrollEntryDto(
    @Json(name = "id") val id: String,
    @Json(name = "staffId") val staffId: String,
    @Json(name = "period") val period: String,
    @Json(name = "grossAmount") val grossAmount: Double,
    @Json(name = "deductions") val deductions: Double,
    @Json(name = "netAmount") val netAmount: Double,
    @Json(name = "status") val status: String,
    @Json(name = "staff") val staff: PayrollStaffDto? = null,
    // Statutory breakdowns (NSSF, NHIF/SHA, PAYE/KRA)
    @Json(name = "kraPin") val kraPin: String? = null,
    @Json(name = "nssfNumber") val nssfNumber: String? = null,
    @Json(name = "shaNumber") val shaNumber: String? = null,
    @Json(name = "bankAccount") val bankAccount: String? = null
)

@JsonClass(generateAdapter = true)
data class PayrollResponse(
    @Json(name = "entries") val entries: List<PayrollEntryDto> = emptyList(),
    @Json(name = "staff") val staff: List<PayrollStaffDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreatePayrollRequest(
    @Json(name = "staffId") val staffId: String,
    @Json(name = "period") val period: String,
    @Json(name = "grossAmount") val grossAmount: Double,
    @Json(name = "deductions") val deductions: Double
)
