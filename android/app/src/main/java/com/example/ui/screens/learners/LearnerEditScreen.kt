package com.example.ui.screens.learners

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.MaryRoyalApp
import com.example.data.remote.model.LearnerPatchRequest
import com.example.ui.common.ErrorStateView
import com.example.ui.common.LoadingSkeleton
import com.example.ui.theme.RoyalBlue
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnerEditScreen(
    learnerId: String,
    onBack: () -> Unit,
    onSaved: () -> Unit
) {
    val repo = MaryRoyalApp.instance.learnerRepository
    val coroutineScope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var grade by remember { mutableStateOf("") }
    var stream by remember { mutableStateOf("") }
    var upiNumber by remember { mutableStateOf("") }
    var physicalAddress by remember { mutableStateOf("") }
    var knownConditions by remember { mutableStateOf("") }
    var allergies by remember { mutableStateOf("") }
    var doctorOrHospital by remember { mutableStateOf("") }

    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(learnerId) {
        val res = repo.getLearnerDetail(learnerId)
        isLoading = false
        res.fold(
            onSuccess = { l ->
                name = l.name
                grade = l.grade
                stream = l.profile?.stream ?: ""
                upiNumber = l.profile?.upiNumber ?: ""
                physicalAddress = l.profile?.physicalAddress ?: ""
                knownConditions = l.profile?.knownConditions ?: ""
                allergies = l.profile?.allergies ?: ""
                doctorOrHospital = l.profile?.doctorOrHospital ?: ""
            },
            onFailure = { errorMessage = it.message }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Learner Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    Button(
                        onClick = {
                            isSaving = true
                            coroutineScope.launch {
                                val patch = LearnerPatchRequest(
                                    name = name.ifBlank { null },
                                    grade = grade.ifBlank { null },
                                    stream = stream.ifBlank { null },
                                    upiNumber = upiNumber.ifBlank { null },
                                    physicalAddress = physicalAddress.ifBlank { null },
                                    knownConditions = knownConditions.ifBlank { null },
                                    allergies = allergies.ifBlank { null },
                                    doctorOrHospital = doctorOrHospital.ifBlank { null }
                                )
                                val res = repo.patchLearner(learnerId, patch)
                                isSaving = false
                                res.fold(
                                    onSuccess = { onSaved() },
                                    onFailure = { errorMessage = it.message }
                                )
                            }
                        },
                        enabled = !isSaving && !isLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.testTag("save_learner_button")
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Save")
                    }
                }
            )
        }
    ) { padding ->
        if (isLoading) {
            LoadingSkeleton(count = 4, modifier = Modifier.padding(padding))
        } else if (errorMessage != null) {
            ErrorStateView(message = errorMessage ?: "", onRetry = { onBack() }, modifier = Modifier.padding(padding))
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Learner Name") },
                    modifier = Modifier.fillMaxWidth().testTag("edit_name_input")
                )

                OutlinedTextField(
                    value = grade,
                    onValueChange = { grade = it },
                    label = { Text("CBC Class / Grade") },
                    modifier = Modifier.fillMaxWidth().testTag("edit_grade_input")
                )

                OutlinedTextField(
                    value = stream,
                    onValueChange = { stream = it },
                    label = { Text("Stream (e.g. Blue, Gold, Main)") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = upiNumber,
                    onValueChange = { upiNumber = it },
                    label = { Text("UPI / NEMIS Number") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = physicalAddress,
                    onValueChange = { physicalAddress = it },
                    label = { Text("Physical Residence Address") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = knownConditions,
                    onValueChange = { knownConditions = it },
                    label = { Text("Medical / Known Health Conditions") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = allergies,
                    onValueChange = { allergies = it },
                    label = { Text("Allergies") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = doctorOrHospital,
                    onValueChange = { doctorOrHospital = it },
                    label = { Text("Doctor or Preferred Hospital") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
