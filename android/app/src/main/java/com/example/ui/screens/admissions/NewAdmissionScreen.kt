package com.example.ui.screens.admissions

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewAdmissionScreen(
    onBack: () -> Unit,
    onAdmissionComplete: () -> Unit
) {
    val repo = MaryRoyalApp.instance.admissionRepository
    val coroutineScope = rememberCoroutineScope()

    var currentStep by remember { mutableIntStateOf(1) }
    var draftId by remember { mutableStateOf<String?>(null) }
    var admissionNo by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Step 1: Learner
    var fullName by remember { mutableStateOf("") }
    var dateOfBirth by remember { mutableStateOf("2018-05-12") }
    var gender by remember { mutableStateOf("Female") }
    var grade by remember { mutableStateOf("Grade 1") }
    var religion by remember { mutableStateOf("Christian") }
    var languagesSpoken by remember { mutableStateOf("English, Kiswahili") }

    // Step 2: Residence
    var county by remember { mutableStateOf("Kisumu") }
    var subCounty by remember { mutableStateOf("Kisumu Central") }
    var ward by remember { mutableStateOf("Railways / Obunga") }
    var village by remember { mutableStateOf("Breweries Area") }
    var physicalAddress by remember { mutableStateOf("Obunga Settlement Road") }

    // Step 3: Guardian
    var guardianName by remember { mutableStateOf("") }
    var guardianRelation by remember { mutableStateOf("Mother") }
    var guardianPhone by remember { mutableStateOf("+254712345678") }
    var guardianEmail by remember { mutableStateOf("") }
    var guardianOccupation by remember { mutableStateOf("") }
    var paysFees by remember { mutableStateOf(true) }

    // Step 4: Emergency Contacts
    var emergencyName by remember { mutableStateOf("") }
    var emergencyPhone by remember { mutableStateOf("+254722000000") }
    var emergencyRelation by remember { mutableStateOf("Aunt") }

    // Step 5: Health
    var knownConditions by remember { mutableStateOf("") }
    var allergies by remember { mutableStateOf("") }
    var doctorOrHospital by remember { mutableStateOf("JOOTRH Kisumu") }

    // Step 6: Fee handoff
    var term by remember { mutableStateOf("2026 Term 1") }
    var transportRequested by remember { mutableStateOf(false) }
    var lunchRequested by remember { mutableStateOf(true) }

    // Step 7: Declaration & Documents
    var hasPassportPhoto by remember { mutableStateOf(true) }
    var hasBirthCert by remember { mutableStateOf(true) }
    var consentAgreed by remember { mutableStateOf(false) }

    // Initialize draft on mount
    LaunchedEffect(Unit) {
        val res = repo.createAdmission()
        res.fold(
            onSuccess = { draft ->
                draftId = draft.id
                admissionNo = draft.admissionNo
            },
            onFailure = { errorMessage = it.message }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("New CBC Admission", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        if (admissionNo.isNotEmpty()) {
                            Text(
                                "No: $admissionNo • Step $currentStep of 7",
                                style = MaterialTheme.typography.labelSmall.copy(color = RoyalGold)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Step Progress Bar
            LinearProgressIndicator(
                progress = { currentStep / 7f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
                color = RoyalBlue,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            if (errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorMessage ?: "",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            AnimatedContent(targetState = currentStep, label = "admissionStep") { step ->
                when (step) {
                    1 -> Step1LearnerBio(
                        fullName = fullName, onFullNameChange = { fullName = it },
                        dateOfBirth = dateOfBirth, onDobChange = { dateOfBirth = it },
                        gender = gender, onGenderChange = { gender = it },
                        grade = grade, onGradeChange = { grade = it },
                        religion = religion, onReligionChange = { religion = it },
                        languages = languagesSpoken, onLanguagesChange = { languagesSpoken = it }
                    )
                    2 -> Step2Residence(
                        county = county, onCountyChange = { county = it },
                        subCounty = subCounty, onSubCountyChange = { subCounty = it },
                        ward = ward, onWardChange = { ward = it },
                        village = village, onVillageChange = { village = it },
                        address = physicalAddress, onAddressChange = { physicalAddress = it }
                    )
                    3 -> Step3Guardian(
                        name = guardianName, onNameChange = { guardianName = it },
                        relation = guardianRelation, onRelationChange = { guardianRelation = it },
                        phone = guardianPhone, onPhoneChange = { guardianPhone = it },
                        email = guardianEmail, onEmailChange = { guardianEmail = it },
                        occupation = guardianOccupation, onOccupationChange = { guardianOccupation = it },
                        paysFees = paysFees, onPaysFeesChange = { paysFees = it }
                    )
                    4 -> Step4Emergency(
                        name = emergencyName, onNameChange = { emergencyName = it },
                        phone = emergencyPhone, onPhoneChange = { emergencyPhone = it },
                        relation = emergencyRelation, onRelationChange = { emergencyRelation = it }
                    )
                    5 -> Step5Health(
                        conditions = knownConditions, onConditionsChange = { knownConditions = it },
                        allergies = allergies, onAllergiesChange = { allergies = it },
                        hospital = doctorOrHospital, onHospitalChange = { doctorOrHospital = it }
                    )
                    6 -> Step6FeeHandoff(
                        term = term, onTermChange = { term = it },
                        transport = transportRequested, onTransportChange = { transportRequested = it },
                        lunch = lunchRequested, onLunchChange = { lunchRequested = it }
                    )
                    7 -> Step7DocumentsAndSubmit(
                        hasPhoto = hasPassportPhoto, onPhotoToggle = { hasPassportPhoto = it },
                        hasCert = hasBirthCert, onCertToggle = { hasBirthCert = it },
                        agreed = consentAgreed, onAgreedToggle = { consentAgreed = it }
                    )
                }
            }

            // Navigation Buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                if (currentStep > 1) {
                    OutlinedButton(onClick = { currentStep-- }) {
                        Text("Previous")
                    }
                } else {
                    Spacer(modifier = Modifier.width(8.dp))
                }

                Button(
                    onClick = {
                        errorMessage = null
                        if (currentStep < 7) {
                            if (currentStep == 1 && fullName.isBlank()) {
                                errorMessage = "Please enter learner's full name."
                                return@Button
                            }
                            if (currentStep == 3 && guardianName.isBlank()) {
                                errorMessage = "Please enter primary guardian name."
                                return@Button
                            }
                            // Save step data to draft
                            draftId?.let { id ->
                                coroutineScope.launch {
                                    val patchData = mapOf(
                                        "learner" to mapOf("fullName" to fullName, "grade" to grade, "gender" to gender),
                                        "residence" to mapOf("county" to county, "physicalAddress" to physicalAddress),
                                        "guardians" to listOf(mapOf("fullName" to guardianName, "phone" to guardianPhone, "relationship" to guardianRelation))
                                    )
                                    repo.patchAdmission(id, currentStep, patchData)
                                }
                            }
                            currentStep++
                        } else {
                            // Final submission
                            if (!consentAgreed) {
                                errorMessage = "You must agree to the admission declaration."
                                return@Button
                            }
                            isSaving = true
                            draftId?.let { id ->
                                coroutineScope.launch {
                                    val res = repo.submitAdmission(id)
                                    isSaving = false
                                    res.fold(
                                        onSuccess = { onAdmissionComplete() },
                                        onFailure = { errorMessage = it.message }
                                    )
                                }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                    modifier = Modifier.testTag("admission_next_button")
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    } else {
                        Text(if (currentStep == 7) "Submit & Enroll" else "Save & Next")
                    }
                }
            }
        }
    }
}

@Composable
private fun Step1LearnerBio(
    fullName: String, onFullNameChange: (String) -> Unit,
    dateOfBirth: String, onDobChange: (String) -> Unit,
    gender: String, onGenderChange: (String) -> Unit,
    grade: String, onGradeChange: (String) -> Unit,
    religion: String, onReligionChange: (String) -> Unit,
    languages: String, onLanguagesChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("1. Learner Identity & CBC Class", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(
            value = fullName,
            onValueChange = onFullNameChange,
            label = { Text("Full Legal Name") },
            placeholder = { Text("e.g. Achieng Michelle Otieno") },
            modifier = Modifier.fillMaxWidth().testTag("admission_name_input")
        )
        OutlinedTextField(
            value = dateOfBirth,
            onValueChange = onDobChange,
            label = { Text("Date of Birth (YYYY-MM-DD)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = gender,
            onValueChange = onGenderChange,
            label = { Text("Gender (Female / Male)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = grade,
            onValueChange = onGradeChange,
            label = { Text("Admitting Grade (PP1 to Grade 9)") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = religion,
            onValueChange = onReligionChange,
            label = { Text("Religion") },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = languages,
            onValueChange = onLanguagesChange,
            label = { Text("Languages Spoken") },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun Step2Residence(
    county: String, onCountyChange: (String) -> Unit,
    subCounty: String, onSubCountyChange: (String) -> Unit,
    ward: String, onWardChange: (String) -> Unit,
    village: String, onVillageChange: (String) -> Unit,
    address: String, onAddressChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("2. Residence & Catchment Area", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(value = county, onValueChange = onCountyChange, label = { Text("County") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = subCounty, onValueChange = onSubCountyChange, label = { Text("Sub-County") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = ward, onValueChange = onWardChange, label = { Text("Ward") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = village, onValueChange = onVillageChange, label = { Text("Village / Local Estate") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = address, onValueChange = onAddressChange, label = { Text("Physical Location Address") }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Step3Guardian(
    name: String, onNameChange: (String) -> Unit,
    relation: String, onRelationChange: (String) -> Unit,
    phone: String, onPhoneChange: (String) -> Unit,
    email: String, onEmailChange: (String) -> Unit,
    occupation: String, onOccupationChange: (String) -> Unit,
    paysFees: Boolean, onPaysFeesChange: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("3. Parent / Primary Guardian Info", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(value = name, onValueChange = onNameChange, label = { Text("Parent / Guardian Name") }, modifier = Modifier.fillMaxWidth().testTag("guardian_name_input"))
        OutlinedTextField(value = relation, onValueChange = onRelationChange, label = { Text("Relationship (Mother/Father/Guardian)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = phone, onValueChange = onPhoneChange, label = { Text("Kenyan Phone Number") }, placeholder = { Text("+254712345678") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = email, onValueChange = onEmailChange, label = { Text("Email Address (Optional)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = occupation, onValueChange = onOccupationChange, label = { Text("Occupation / Employer") }, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = paysFees, onCheckedChange = onPaysFeesChange)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Responsible for School Fees Payments")
        }
    }
}

@Composable
private fun Step4Emergency(
    name: String, onNameChange: (String) -> Unit,
    phone: String, onPhoneChange: (String) -> Unit,
    relation: String, onRelationChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("4. Emergency Contacts & Authorized Pickups", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(value = name, onValueChange = onNameChange, label = { Text("Emergency Contact Person") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = phone, onValueChange = onPhoneChange, label = { Text("Emergency Phone Number") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = relation, onValueChange = onRelationChange, label = { Text("Relationship to Learner") }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Step5Health(
    conditions: String, onConditionsChange: (String) -> Unit,
    allergies: String, onAllergiesChange: (String) -> Unit,
    hospital: String, onHospitalChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("5. Medical Details & Health Declaration", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(value = conditions, onValueChange = onConditionsChange, label = { Text("Known Medical Conditions (if any)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = allergies, onValueChange = onAllergiesChange, label = { Text("Known Food or Drug Allergies") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = hospital, onValueChange = onHospitalChange, label = { Text("Preferred Doctor or Hospital") }, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Step6FeeHandoff(
    term: String, onTermChange: (String) -> Unit,
    transport: Boolean, onTransportChange: (Boolean) -> Unit,
    lunch: Boolean, onLunchChange: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("6. Fee Handoff & Auxiliary Services", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        OutlinedTextField(value = term, onValueChange = onTermChange, label = { Text("Enrollment Term") }, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = transport, onCheckedChange = onTransportChange)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Request School Transport Service")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = lunch, onCheckedChange = onLunchChange)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Request School Hot Lunch Program")
        }
    }
}

@Composable
private fun Step7DocumentsAndSubmit(
    hasPhoto: Boolean, onPhotoToggle: (Boolean) -> Unit,
    hasCert: Boolean, onCertToggle: (Boolean) -> Unit,
    agreed: Boolean, onAgreedToggle: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("7. Documents Verification & Final Consent", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = hasPhoto, onCheckedChange = onPhotoToggle)
                    Text("Passport Photo Verified & Attached", style = MaterialTheme.typography.bodyMedium)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = hasCert, onCheckedChange = onCertToggle)
                    Text("Birth Certificate Copy Uploaded", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = agreed, onCheckedChange = onAgreedToggle)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "I hereby declare that the information provided for admission to Mary Royal Primary & Junior School is accurate.",
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}
