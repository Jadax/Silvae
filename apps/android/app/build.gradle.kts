import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.google.services)
}

android {
    namespace = "org.silvae"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.silvae"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.4.1"
        vectorDrawables { useSupportLibrary = true }
        // Supplied as -PSILVAE_API_BASE (or an ORG_GRADLE_PROJECT_...
        // environment variable) for each deployment. Keep the default empty
        // so a stale hostname can never ship.
        val apiBase = providers.gradleProperty("SILVAE_API_BASE").orElse("").get().trimEnd('/')
        buildConfigField("String", "API_BASE", "\"$apiBase\"")
    }

    // Release signing: values come from (in order of preference) -P gradle
    // properties, then apps/android/keystore.properties (gitignored — see
    // apps/android/RELEASE.md). Never committed; release builds are simply
    // unsigned if neither is present.
    val keystoreProps = Properties().apply {
        val file = rootProject.file("keystore.properties")
        if (file.exists()) file.inputStream().use { load(it) }
    }
    fun releaseProp(name: String): String? =
        (findProperty(name) as String?) ?: keystoreProps.getProperty(name)

    val releaseStoreFile = releaseProp("SILVAE_KEYSTORE_FILE")

    signingConfigs {
        create("release") {
            if (releaseStoreFile != null) {
                storeFile = rootProject.file(releaseStoreFile)
                storePassword = releaseProp("SILVAE_STORE_PASSWORD")
                keyAlias = releaseProp("SILVAE_KEY_ALIAS")
                keyPassword = releaseProp("SILVAE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.work.compiler)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.nav.compose)

    implementation(libs.androidx.nav.compose)
    implementation(libs.coil.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.play.services.auth)
    implementation(libs.play.services.location)
    implementation(libs.androidx.exifinterface)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.serialization.json)
}
