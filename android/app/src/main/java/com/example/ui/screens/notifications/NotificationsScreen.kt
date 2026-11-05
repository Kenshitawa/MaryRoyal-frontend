package com.example.ui.screens.notifications

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.data.remote.model.NotificationDto
import com.example.ui.common.*
import com.example.ui.theme.RoyalBlue
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen() {
    val repo = MaryRoyalApp.instance.notificationRepository
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<List<NotificationDto>>>(UiState.Loading) }

    fun loadNotifications() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getNotifications()
            res.fold(
                onSuccess = { resp ->
                    if (resp.notifications.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(resp.notifications)
                },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load notifications.") }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadNotifications()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "School Notifications", subtitle = "Announcements & Action Alerts")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("notifications_screen")
        ) {
            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 4)
                is UiState.Empty -> EmptyStateView(
                    title = "All Caught Up!",
                    message = "No new school announcements or unread alerts at this time."
                )
                is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadNotifications() })
                is UiState.Success -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${current.data.count { !it.read }} Unread",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = RoyalBlue)
                        )
                        TextButton(onClick = {
                            coroutineScope.launch {
                                repo.markAllAsRead()
                                loadNotifications()
                            }
                        }) {
                            Text("Mark All Read")
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(current.data, key = { it.id }) { item ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        if (!item.read) {
                                            coroutineScope.launch {
                                                repo.markAsRead(item.id)
                                                loadNotifications()
                                            }
                                        }
                                    }
                                    .testTag("notification_card_${item.id}"),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (!item.read) RoyalBlue.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surface
                                ),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = item.title,
                                            fontWeight = if (!item.read) FontWeight.Bold else FontWeight.SemiBold,
                                            color = if (!item.read) RoyalBlue else Color.Unspecified
                                        )
                                        if (!item.read) {
                                            Surface(color = RoyalBlue, shape = RoundedCornerShape(4.dp)) {
                                                Text("NEW", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                                            }
                                        }
                                    }
                                    Text(item.body, style = MaterialTheme.typography.bodySmall)
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
