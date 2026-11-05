package com.example.data.security

import android.app.Activity
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext

/**
 * Applies FLAG_SECURE to the current window to prevent screenshots, screen recording,
 * and preview thumbnails in the recents switcher for sensitive screens (fees, payroll, statutory details).
 */
@Composable
fun SecureScreenEffect(enabled: Boolean = true) {
    val context = LocalContext.current
    DisposableEffect(enabled) {
        val activity = context as? Activity
        if (activity != null && enabled) {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        onDispose {
            val act = context as? Activity
            if (act != null && enabled) {
                act.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }
}
