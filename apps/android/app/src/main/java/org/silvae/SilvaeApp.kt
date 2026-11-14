package org.silvae

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.HiltAndroidApp
import org.silvae.data.sync.CloudSync
import org.silvae.notifications.WateringReminderWorker
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@HiltAndroidApp
class SilvaeApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var cloudSync: CloudSync

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()

    override fun onCreate() {
        super.onCreate()
        cloudSync.bind()
        scheduleWateringReminders()
    }

    private fun scheduleWateringReminders() {
        val request = PeriodicWorkRequestBuilder<WateringReminderWorker>(24, TimeUnit.HOURS).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "watering_reminders",
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}
