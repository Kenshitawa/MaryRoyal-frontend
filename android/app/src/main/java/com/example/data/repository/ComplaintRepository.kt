package com.example.data.repository

import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.AddComplaintReplyRequest
import com.example.data.remote.model.ComplaintDto
import com.example.data.remote.model.CreateComplaintRequest

class ComplaintRepository(
    private val api: MaryRoyalApiService
) {
    suspend fun getComplaints(): Result<List<ComplaintDto>> {
        return try {
            val response = api.getComplaints()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.complaints)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load complaints."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createComplaint(
        subject: String,
        category: String,
        message: String,
        recipientRole: String,
        learnerId: String
    ): Result<Boolean> {
        return try {
            val response = api.createComplaint(
                CreateComplaintRequest(
                    subject = subject,
                    category = category,
                    message = message,
                    recipientRole = recipientRole,
                    learnerId = learnerId
                )
            )
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Could not submit complaint."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addReply(complaintId: String, message: String): Result<Boolean> {
        return try {
            val response = api.addComplaintReply(complaintId, AddComplaintReplyRequest(message))
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Could not send reply."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
