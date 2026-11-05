package com.example.data.remote.api

import com.example.BuildConfig
import com.example.data.security.SecureTokenManager
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    fun create(
        tokenManager: SecureTokenManager,
        onSessionExpired: () -> Unit
    ): MaryRoyalApiService {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
            // Redact sensitive headers
            redactHeader("Cookie")
            redactHeader("Set-Cookie")
            redactHeader("Authorization")
        }

        val authInterceptor = AuthInterceptor(tokenManager, onSessionExpired)
        val authenticator = SessionAuthenticator(tokenManager, onSessionExpired)

        // Strict HTTPS and optional certificate pinning for production host
        val certificatePinner = CertificatePinner.Builder()
            // Pins can be added here if static cert hash is enforced by ops
            .build()

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .authenticator(authenticator)
            .certificatePinner(certificatePinner)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        val moshi = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()

        val baseUrl = if (BuildConfig.BASE_URL.endsWith("/")) {
            BuildConfig.BASE_URL
        } else {
            "${BuildConfig.BASE_URL}/"
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

        return retrofit.create(MaryRoyalApiService::class.java)
    }
}
