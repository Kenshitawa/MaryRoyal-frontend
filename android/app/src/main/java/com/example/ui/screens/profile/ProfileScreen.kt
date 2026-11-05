package com.example.ui.screens.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.R
import com.example.data.security.BiometricAuthHelper
import com.example.ui.common.SchoolCrestHeader
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    onChangePassword: () -> Unit,
    onLogout: () -> Unit
) {
    val app = MaryRoyalApp.instance
    val authRepo = app.authRepository
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val userName = authRepo.getUserName()
    val userEmail = authRepo.getUserEmail() ?: ""
    val userRole = authRepo.getUserRole()

    var biometricEnabled by remember { mutableStateOf(authRepo.isBiometricEnabled()) }
    val isBiometricSupported = remember { BiometricAuthHelper.isBiometricAvailable(context) }
    var showLogoutConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "Profile & Security", subtitle = "Mary Royal Credential Center")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // User Header Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .border(1.5.dp, RoyalBlue, CircleShape)
                            .padding(4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_school_crest),
                            contentDescription = "Mary Royal Crest",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = userName,
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = RoyalBlue)
                        )
                        Text(
                            text = userEmail,
                            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                        )
                        Surface(
                            color = RoyalGold.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier.padding(top = 4.dp)
                        ) {
                            Text(
                                text = "Role: ${userRole.replace("_", " ")}",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }

            // Security Settings Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Security & Access Settings", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)

                    // Biometric Switch
                    if (isBiometricSupported) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Biometric Quick Unlock", fontWeight = FontWeight.SemiBold)
                                Text("Unlock portal using fingerprint or facial recognition", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Switch(
                                checked = biometricEnabled,
                                onCheckedChange = {
                                    biometricEnabled = it
                                    authRepo.setBiometricEnabled(it)
                                },
                                modifier = Modifier.testTag("biometric_toggle_switch")
                            )
                        }
                        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                    }

                    // Change Password
                    OutlinedButton(
                        onClick = onChangePassword,
                        modifier = Modifier.fillMaxWidth().testTag("profile_change_password_button")
                    ) {
                        Icon(Icons.Default.LockReset, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Change Portal Password")
                    }
                }
            }

            // School & CBC Information Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Mary Royal Primary & Junior School", fontWeight = FontWeight.Bold, color = RoyalBlue)
                    Text("Location: Obunga Informal Settlement, Breweries Area, Kisumu, Kenya", style = MaterialTheme.typography.bodySmall)
                    Text("Motto: “Nurturing Excellence Through CBC” • Hard Work Pays", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, color = Color(0xFF7A5400))
                    Text("Curriculum: Kenya Competency-Based Curriculum (Playgroup to Grade 9)", style = MaterialTheme.typography.bodySmall)
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Logout Button
            Button(
                onClick = { showLogoutConfirm = true },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp).testTag("logout_button")
            ) {
                Icon(Icons.Default.ExitToApp, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Log Out of Portal", fontWeight = FontWeight.Bold)
            }
        }

        if (showLogoutConfirm) {
            AlertDialog(
                onDismissRequest = { showLogoutConfirm = false },
                title = { Text("Confirm Logout") },
                text = { Text("Are you sure you want to end your session? Your secure session token will be cleared from Android Keystore.") },
                confirmButton = {
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                authRepo.logout()
                                showLogoutConfirm = false
                                onLogout()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        Text("Log Out")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showLogoutConfirm = false }) { Text("Cancel") }
                }
            )
        }
    }
}
