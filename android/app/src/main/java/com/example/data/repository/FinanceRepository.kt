package com.example.data.repository

import com.example.data.local.dao.InvoiceDao
import com.example.data.local.entity.CachedInvoiceEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class FinanceRepository(
    private val api: MaryRoyalApiService,
    private val invoiceDao: InvoiceDao
) {
    val cachedInvoices: Flow<List<InvoiceDto>> = invoiceDao.getAllInvoices().map { entities ->
        entities.map {
            InvoiceDto(
                id = it.id,
                learnerId = it.learnerId,
                term = it.term,
                total = it.total,
                paid = it.paid,
                balance = it.balance,
                learner = if (it.learnerName != null) AssessmentLearnerInfo(
                    id = it.learnerId,
                    name = it.learnerName,
                    admissionNo = it.learnerAdmissionNo ?: "",
                    grade = ""
                ) else null
            )
        }
    }

    suspend fun getInvoices(): Result<List<InvoiceDto>> {
        return try {
            val response = api.getInvoices()
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.invoices
                // Cache into Room
                val entities = list.map {
                    CachedInvoiceEntity(
                        id = it.id,
                        learnerId = it.learnerId,
                        term = it.term,
                        total = it.total,
                        paid = it.paid,
                        balance = it.balance,
                        learnerName = it.learner?.name,
                        learnerAdmissionNo = it.learner?.admissionNo,
                        linesCount = it.lines.size
                    )
                }
                invoiceDao.clearInvoices()
                invoiceDao.insertInvoices(entities)
                Result.success(list)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load invoices."))
            }
        } catch (e: IOException) {
            Result.failure(Exception("Offline: Displaying cached fee records if available."))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createInvoice(request: CreateInvoiceRequest): Result<Boolean> {
        return try {
            val response = api.createInvoice(request)
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to generate invoice."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun recordPayment(request: RecordPaymentRequest): Result<PaymentResponse> {
        return try {
            val response = api.recordPayment(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Payment recording failed."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getFeeStructures(): Result<List<FeeStructureDto>> {
        return try {
            val response = api.getFeeStructures()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.structures)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load fee structures."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPayroll(): Result<PayrollResponse> {
        return try {
            val response = api.getPayroll()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load payroll records."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createPayroll(request: CreatePayrollRequest): Result<Boolean> {
        return try {
            val response = api.createPayroll(request)
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Could not create payroll entry."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
