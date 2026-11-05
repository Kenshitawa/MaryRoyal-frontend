package com.example.ui.screens.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.example.MaryRoyalApp
import com.example.R
import com.example.data.repository.LoginResult
import com.example.data.security.BiometricAuthHelper
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLoginSuccess: (forcePasswordChange: Boolean) -> Unit
) {
    val app = MaryRoyalApp.instance
    val authRepo = app.authRepository
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(true) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var lockoutSeconds by remember { mutableStateOf(authRepo.getLockoutRemaining()) }

    // Two-factor state
    var showTwoFactorDialog by remember { mutableStateOf(authRepo.isTwoFactorPending()) }
    var twoFactorCode by remember { mutableStateOf("") }
    var twoFactorError by remember { mutableStateOf<String?>(null) }

    val isBiometricEnabled = authRepo.isBiometricEnabled()
    val isBiometricSupported = remember { BiometricAuthHelper.isBiometricAvailable(context) }

    fun triggerBiometricUnlock() {
        val activity = context as? FragmentActivity ?: return
        BiometricAuthHelper.promptBiometric(
            activity = activity,
            title = "Mary Royal Biometric Login",
            subtitle = "Verify your fingerprint or face to sign in",
            onSuccess = {
                onLoginSuccess(false)
            },
            onError = { msg ->
                errorMessage = msg
            }
        )
    }

    LaunchedEffect(Unit) {
        if (isBiometricEnabled && isBiometricSupported && authRepo.isLoggedIn()) {
            triggerBiometricUnlock()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize().testTag("login_screen"),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(20.dp))

            // School Crest & Header
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_school_crest),
                    contentDescription = "Mary Royal Crest",
                    modifier = Modifier.size(90.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Mary Royal School",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = RoyalBlue
                ),
                textAlign = TextAlign.Center
            )

            Text(
                text = "Obunga, Kisumu, Kenya",
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )

            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = RoyalGold.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = "“Nurturing Excellence Through CBC”",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color(0xFF7A5400),
                            fontWeight = FontWeight.SemiBold
                        ),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
                Surface(
                    color = RoyalBlue.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = "Hard Work Pays",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = RoyalBlue,
                            fontWeight = FontWeight.Bold
                        ),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Sign In to Portal",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                    )

                    AnimatedVisibility(visible = errorMessage != null) {
                        Surface(
                            color = MaterialTheme.colorScheme.errorContainer,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage ?: "",
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    if (lockoutSeconds > 0) {
                        Surface(
                            color = Color(0xFFFFF3CD),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Account temporarily locked due to repeated failed logins. Please wait $lockoutSeconds seconds.",
                                color = Color(0xFF856404),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    // Email or Phone input
                    OutlinedTextField(
                        value = identifier,
                        onValueChange = {
                            identifier = it
                            errorMessage = null
                        },
                        label = { Text("Email, Username or Phone") },
                        placeholder = { Text("e.g. director@maryroyal.ac.ke") },
                        leadingIcon = {
                            Icon(Icons.Default.Person, contentDescription = null, tint = RoyalBlue)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("login_identifier_input")
                    )

                    // Password input
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            errorMessage = null
                        },
                        label = { Text("Password") },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = RoyalBlue)
                        },
                        trailingIcon = {
                            IconButton(
                                onClick = { showPassword = !showPassword },
                                modifier = Modifier.testTag("toggle_password_visibility")
                            ) {
                                Icon(
                                    imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (showPassword) "Hide password" else "Show password",
                                    tint = if (showPassword) RoyalBlue else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                            }
                        ),
                        modifier = Modifier.fillMaxWidth().testTag("login_password_input")
                    )

                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            if (identifier.isBlank() || password.isBlank()) {
                                errorMessage = "Please enter your username/phone and password."
                                return@Button
                            }
                            isLoading = true
                            errorMessage = null
                            coroutineScope.launch {
                                val result = authRepo.login(identifier, password)
                                isLoading = false
                                result.fold(
                                    onSuccess = { res ->
                                        when (res) {
                                            is LoginResult.Success -> {
                                                onLoginSuccess(res.forcePasswordChange)
                                            }
                                            is LoginResult.RequiresTwoFactor -> {
                                                showTwoFactorDialog = true
                                            }
                                        }
                                    },
                                    onFailure = { err ->
                                        errorMessage = err.message
                                        lockoutSeconds = authRepo.getLockoutRemaining()
                                    }
                                )
                            }
                        },
                        enabled = !isLoading && lockoutSeconds <= 0,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("login_submit_button")
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(22.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Sign In", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }

                    if (isBiometricEnabled && isBiometricSupported) {
                        OutlinedButton(
                            onClick = { triggerBiometricUnlock() },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("login_biometric_button")
                        ) {
                            Icon(Icons.Default.Fingerprint, contentDescription = null, tint = RoyalBlue)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Quick Biometric Unlock")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Protected by strict encryption, HTTPS & Android Keystore",
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp
                ),
                textAlign = TextAlign.Center
            )
        }

        // Two-Factor Verification Modal Dialog
        if (showTwoFactorDialog) {
            AlertDialog(
                onDismissRequest = { /* mandatory dialog */ },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = RoyalBlue)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("2-Step Verification")
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = "Additional security is required for administrative and financial roles (Director, Head Teacher, Accountant).",
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (twoFactorError != null) {
                            Text(
                                text = twoFactorError ?: "",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        OutlinedTextField(
                            value = twoFactorCode,
                            onValueChange = {
                                twoFactorCode = it
                                twoFactorError = null
                            },
                            label = { Text("Enter 6-digit Code") },
                            placeholder = { Text("e.g. 123456") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth().testTag("two_factor_code_input")
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val res = authRepo.completeTwoFactorVerification(twoFactorCode)
                            if (res.isSuccess) {
                                showTwoFactorDialog = false
                                onLoginSuccess(false)
                            } else {
                                twoFactorError = res.exceptionOrNull()?.message ?: "Invalid code."
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.testTag("two_factor_confirm_button")
                    ) {
                        Text("Verify & Continue")
                    }
                },
                dismissButton = {
                    TextButton(onClick = {
                        coroutineScope.launch {
                            authRepo.logout()
                            showTwoFactorDialog = false
                        }
                    }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
