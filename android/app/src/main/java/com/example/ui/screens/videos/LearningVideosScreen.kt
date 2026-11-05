package com.example.ui.screens.videos

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.data.remote.model.LearningVideoDto
import com.example.data.remote.model.LearningVideosResponse
import com.example.ui.common.*
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearningVideosScreen() {
    val app = MaryRoyalApp.instance
    val repo = app.learningVideoRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<LearningVideosResponse>>(UiState.Loading) }
    var showAddDialog by remember { mutableStateOf(false) }

    // Add Video Form State
    var videoUrl by remember { mutableStateOf("") }
    var videoGrade by remember { mutableStateOf("Grade 1") }
    var videoSubject by remember { mutableStateOf("Mathematics") }
    var videoStrand by remember { mutableStateOf("Numbers & Fractions") }
    var isAdding by remember { mutableStateOf(false) }

    fun loadVideos() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getLearningVideos()
            res.fold(
                onSuccess = { state = UiState.Success(it) },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load learning videos.") }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadVideos()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(
                title = "CBC Learning Videos",
                subtitle = "Tailored Revision for Weak Topics"
            )
        },
        floatingActionButton = {
            if (role == UserRole.TEACHER || role == UserRole.DIRECTOR || role == UserRole.HEAD_TEACHER) {
                ExtendedFloatingActionButton(
                    onClick = { showAddDialog = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Add Video") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("add_video_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("learning_videos_screen")
        ) {
            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 5)
                is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadVideos() })
                is UiState.Success -> {
                    val data = current.data
                    val weakTopics = data.weakTopics ?: emptyList()
                    val videos = data.videos

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Weak Topics Banner (Only for learners with assessment score < 60)
                        if (weakTopics.isNotEmpty()) {
                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7))
                                ) {
                                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Lightbulb, contentDescription = null, tint = Color(0xFFB45309))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "Identified Weak Topics for Revision",
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF92400E)
                                            )
                                        }
                                        Text(
                                            text = "Based on your recent assessment marks (< 60%), here are recommended concepts to master:",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF92400E)
                                        )

                                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            items(weakTopics) { wt ->
                                                Surface(
                                                    color = Color.White,
                                                    shape = RoundedCornerShape(8.dp),
                                                    shadowElevation = 1.dp
                                                ) {
                                                    Text(
                                                        text = "${wt.subject}: ${wt.strand ?: "General"}",
                                                        fontWeight = FontWeight.SemiBold,
                                                        fontSize = 11.sp,
                                                        color = Color(0xFF92400E),
                                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        item {
                            Text(
                                text = "Curated Lessons (${videos.size})",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }

                        if (videos.isEmpty()) {
                            item {
                                EmptyStateView(
                                    title = "No Revision Videos Yet",
                                    message = "Teachers will publish CBC instructional videos here soon."
                                )
                            }
                        } else {
                            items(videos, key = { it.id }) { video ->
                                Card(
                                    modifier = Modifier.fillMaxWidth().testTag("video_card_${video.id}"),
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
                                            Text(
                                                text = "${video.subject} - ${video.grade}",
                                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = RoyalBlue)
                                            )
                                            if (video.watched) {
                                                Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(6.dp)) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    ) {
                                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669), modifier = Modifier.size(12.dp))
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        Text("Completed", color = Color(0xFF065F46), fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                                    }
                                                }
                                            }
                                        }

                                        Text(
                                            text = "Strand: ${video.strand}${video.subStrand?.let { " ($it)" } ?: ""}",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
                                        )

                                        Button(
                                            onClick = {
                                                // Launch video in browser or YouTube app
                                                try {
                                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(video.url))
                                                    context.startActivity(intent)
                                                } catch (_: Exception) {}

                                                // Record watched in backend
                                                coroutineScope.launch {
                                                    repo.markVideoWatched(video.id)
                                                    loadVideos()
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                                            shape = RoundedCornerShape(10.dp),
                                            modifier = Modifier.fillMaxWidth().testTag("watch_video_button_${video.id}")
                                        ) {
                                            Icon(Icons.Default.PlayCircle, contentDescription = null)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(if (video.watched) "Watch Again" else "Watch Lesson & Complete")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else -> Unit
            }
        }

        // Add Video Modal (Teacher/Admin)
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add Learning Video") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = videoUrl,
                            onValueChange = { videoUrl = it },
                            label = { Text("Video URL (e.g. YouTube link)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = videoGrade,
                            onValueChange = { videoGrade = it },
                            label = { Text("CBC Grade (e.g. Grade 1)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = videoSubject,
                            onValueChange = { videoSubject = it },
                            label = { Text("Subject") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = videoStrand,
                            onValueChange = { videoStrand = it },
                            label = { Text("Strand / Weak Topic") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (videoUrl.isNotBlank() && videoSubject.isNotBlank()) {
                                isAdding = true
                                coroutineScope.launch {
                                    repo.addVideo(videoUrl, videoGrade, videoSubject, videoStrand)
                                    isAdding = false
                                    showAddDialog = false
                                    loadVideos()
                                }
                            }
                        },
                        enabled = !isAdding && videoUrl.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue)
                    ) {
                        Text("Add Video")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}
