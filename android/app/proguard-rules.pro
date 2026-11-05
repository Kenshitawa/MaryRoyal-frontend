# Add project specific ProGuard rules here.
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature

# Keep Retrofit & OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# Keep Moshi models
-dontwarn com.squareup.moshi.**
-keep class com.squareup.moshi.** { *; }
-keep class com.example.data.remote.model.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json *;
    @com.squareup.moshi.JsonClass *;
}

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Android Security & Biometric
-keep class androidx.security.crypto.** { *; }
-keep class androidx.biometric.** { *; }
